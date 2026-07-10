'use server';

import { createClient } from '@/lib/supabase/server';
import { generateEfacturaXML, submitToANAF, isValidAnafConnection } from '@/lib/efactura/stub';
import { revalidatePath } from 'next/cache';

export async function sendToEfactura(invoiceId: string) {
  const supabase = await createClient();

  try {
    const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
    if (!profile) throw new Error('Profil negăsit');
    if (profile.role !== 'admin') throw new Error('Doar administratorii pot trimite e-Factura.');

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, clients(*), tenants(*)')
      .eq('id', invoiceId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!invoice) {
      throw new Error('Factură negăsită sau acces interzis');
    }

    // Get fresh connection - enhance check for expiry before send
    const { data: connection } = await supabase
      .from('tenant_anaf_connections')
      .select('*')
      .eq('tenant_id', invoice.tenant_id)
      .single();

    if (!isValidAnafConnection(connection)) {
      // Auto-mark expired if past expiry
      if (connection?.token_expires_at && new Date(connection.token_expires_at) < new Date() && connection.status !== 'expired') {
        await supabase.from('tenant_anaf_connections').update({ status: 'expired' }).eq('tenant_id', invoice.tenant_id);
      }
      throw new Error('Conexiune ANAF invalidă sau token expirat. Te rog reconectează din Setări.');
    }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    const xml = generateEfacturaXML(
      invoice,
      items || [],
      { ...invoice.tenants, cui: connection.cui },
      invoice.clients
    );

    // Sign XML (real: use qualified certificate)
    const { signEfacturaXML } = await import('@/lib/efactura/sign');
    const signedXml = await signEfacturaXML(xml);

    // This function is ready for real ANAF call (use connection.access_token).
    // Currently simulates.
    const result = await submitToANAF(signedXml, connection, invoice.tenant_id);

    // Note: invoices has no last_error column (only tenant_anaf_connections does) —
    // writing one here silently failed the whole update, so "Trimite ANAF" never
    // actually persisted a status change despite reporting success.
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        efactura_status: result.status || 'sent',
        efactura_id: result.efactura_id,
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath('/invoices');
  } catch (err: any) {
    console.error('[sendToEfactura error]', err);
    throw new Error(err.message || 'Eroare la trimiterea către ANAF');
  }
}
