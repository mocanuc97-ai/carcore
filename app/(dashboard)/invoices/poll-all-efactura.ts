'use server';

import { createClient } from '@/lib/supabase/server';
import { checkEfacturaStatus, isValidAnafConnection } from '@/lib/efactura/stub';
import { revalidatePath } from 'next/cache';

export async function pollAllPendingEfactura() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('No tenant');
    if (profile.role !== 'admin') throw new Error('Doar administratorii pot rula poll ANAF.');

    // Enhance tenant_anaf_connections checks before poll (expiry)
    const { data: connection } = await supabase
      .from('tenant_anaf_connections')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!isValidAnafConnection(connection)) {
      if (connection?.token_expires_at && new Date(connection.token_expires_at) < new Date() && connection.status !== 'expired') {
        await supabase.from('tenant_anaf_connections').update({ status: 'expired' }).eq('tenant_id', profile.tenant_id);
      }
      throw new Error('No active/valid ANAF connection (token may be expired)');
    }

    // Find all invoices in processing for this tenant
    const { data: pending } = await supabase
      .from('invoices')
      .select('id, efactura_id, efactura_status')
      .eq('tenant_id', profile.tenant_id)
      .eq('efactura_status', 'in_processing');

    let updated = 0;

    // Sequential processing to minimize races on concurrent rapid polls.
    // Note on polling races: rapid calls (e.g. browser rapid clicks on "Verifică toate") may still overlap
    // due to serverless concurrency. Status updates are mostly idempotent. For stronger guarantees use
    // DB advisory lock (pg_advisory_lock per tenant_id) or a last_poll_at debounce + conditional update.
    for (const inv of pending || []) {
      if (!inv.efactura_id) continue;

      // Re-check still pending to reduce overwrite races
      const { data: current } = await supabase
        .from('invoices')
        .select('efactura_status')
        .eq('id', inv.id)
        .single();
      if (current?.efactura_status !== 'in_processing') continue;

      const result = await checkEfacturaStatus(inv.efactura_id, connection.access_token!);

      await supabase
        .from('invoices')
        .update({ efactura_status: result.status })
        .eq('id', inv.id);

      updated++;
    }

    revalidatePath('/dashboard/invoices');

    return { updated, total: pending?.length || 0 };
  } catch (err: any) {
    console.error('[pollAllPendingEfactura error]', err);
    throw new Error(err.message || 'Eroare la polling ANAF');
  }
}
