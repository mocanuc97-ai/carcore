'use server';

import { createClient } from '@/lib/supabase/server';
import { generateEfacturaXML } from '@/lib/efactura/stub';

export async function getEfacturaXML(invoiceId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
  if (profile?.role !== 'admin') throw new Error('Doar admin poate exporta XML e-Factura.');

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*), tenants(*)')
    .eq('id', invoiceId)
    .eq('tenant_id', profile?.tenant_id)
    .single();

  if (!invoice) throw new Error('Invoice not found or tenant mismatch');

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);

  // Use connection.cui consistently
  const { data: connection } = await supabase
    .from('tenant_anaf_connections')
    .select('cui')
    .eq('tenant_id', invoice.tenant_id)
    .single();

  const xml = generateEfacturaXML(
    invoice,
    items || [],
    { ...invoice.tenants, cui: connection?.cui || invoice.tenants?.cui || '' },
    invoice.clients
  );

  return xml;
}
