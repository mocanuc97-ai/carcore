import { createClient } from '@/lib/supabase/server';
import { generateEfacturaXML } from '@/lib/efactura/stub';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('tenant_id').eq('id', user.id).single() : { data: null };

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*), tenants(*)')
    .eq('id', id)
    .eq('tenant_id', profile?.tenant_id)
    .single();

  if (!invoice) {
    return new NextResponse('Invoice not found or tenant mismatch', { status: 404 });
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id);

  // Use connection.cui consistently (fallback to tenant if no connection)
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

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="efactura-${invoice.number}.xml"`,
    },
  });
}
