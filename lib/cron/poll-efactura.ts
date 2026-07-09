import { createAdminClient } from '@/lib/supabase/admin';
import { checkEfacturaStatus, isValidAnafConnection, type AnafConnection } from '@/lib/efactura/stub';

interface TenantAnafConnectionRow extends AnafConnection {
  tenant_id: string;
}

// Cron-safe variant of the "Verifică toate" action: runs with the service role
// (no user session available in a cron invocation) and polls every tenant
// with an active ANAF connection, instead of just the current session's tenant.
export async function pollAllPendingEfacturaForAllTenants() {
  const supabase = createAdminClient();

  const { data: connections } = await supabase
    .from('tenant_anaf_connections')
    .select('*')
    .eq('status', 'connected')
    .returns<TenantAnafConnectionRow[]>();

  let tenantsPolled = 0;
  let totalPending = 0;
  let totalUpdated = 0;

  for (const connection of connections || []) {
    if (!isValidAnafConnection(connection)) {
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        await supabase.from('tenant_anaf_connections').update({ status: 'expired' }).eq('tenant_id', connection.tenant_id);
      }
      continue;
    }

    const { data: pending } = await supabase
      .from('invoices')
      .select('id, efactura_id, efactura_status')
      .eq('tenant_id', connection.tenant_id)
      .eq('efactura_status', 'in_processing');

    tenantsPolled++;
    totalPending += pending?.length || 0;

    for (const inv of pending || []) {
      if (!inv.efactura_id) continue;

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

      totalUpdated++;
    }
  }

  return { tenantsPolled, totalPending, totalUpdated };
}
