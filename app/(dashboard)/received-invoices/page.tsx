import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import ReceivedInvoicesClient from './ReceivedInvoicesClient';

export default async function ReceivedInvoicesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('default_parts_markup_percent')
    .eq('id', tenantId)
    .single();

  const { data: invoices } = await supabase
    .from('received_invoices')
    .select('*, suppliers(name, cui), received_invoice_items(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (
    <ReceivedInvoicesClient
      invoices={invoices || []}
      defaultMarkupPercent={Number(tenant?.default_parts_markup_percent ?? 20)}
      role={profile?.role || 'reception'}
    />
  );
}
