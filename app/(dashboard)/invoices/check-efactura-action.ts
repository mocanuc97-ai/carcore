'use server';

import { createClient } from '@/lib/supabase/server';
import { checkEfacturaStatus, isValidAnafConnection } from '@/lib/efactura/stub';
import { revalidatePath } from 'next/cache';

export async function checkEfacturaStatusAction(invoiceId: string) {
  const supabase = await createClient();

  try {
    const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
    if (!profile) throw new Error('Profil negăsit');
    if (profile.role !== 'admin') throw new Error('Doar administratorii pot verifica status e-Factura.');

    const { data: invoice } = await supabase
      .from('invoices')
      .select('efactura_id, tenant_id')
      .eq('id', invoiceId)
      .eq('tenant_id', profile.tenant_id)
      .single();

  if (!invoice?.efactura_id) {
    throw new Error('Această factură nu a fost încă trimisă la ANAF.');
  }

  // Enhance tenant_anaf_connections check before poll (expiry)
  const { data: connection } = await supabase
    .from('tenant_anaf_connections')
    .select('*')
    .eq('tenant_id', invoice.tenant_id)
    .single();

  if (!isValidAnafConnection(connection)) {
    if (connection?.token_expires_at && new Date(connection.token_expires_at) < new Date() && connection.status !== 'expired') {
      await supabase.from('tenant_anaf_connections').update({ status: 'expired' }).eq('tenant_id', invoice.tenant_id);
    }
    throw new Error('Conexiune ANAF invalidă sau token expirat. Te rog reconectează din Setări.');
  }

  const result = await checkEfacturaStatus(invoice.efactura_id, connection.access_token!);

  await supabase
    .from('invoices')
    .update({ efactura_status: result.status })
    .eq('id', invoiceId);

  revalidatePath('/dashboard/invoices');
  } catch (err: any) {
    console.error('[checkEfacturaStatusAction error]', err);
    throw new Error(err.message || 'Eroare la verificarea statusului ANAF');
  }
}