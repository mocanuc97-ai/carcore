'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { simulateIncomingEfacturaMessage } from '@/lib/efactura/receive-stub';
import { isValidAnafConnection } from '@/lib/efactura/stub';
import { nonNegativeNumber } from '@/lib/validation';

export async function pollReceivedEfactura() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Nu ești autentificat');
  if (profile.role !== 'admin') throw new Error('Doar administratorii pot verifica facturile primite prin ANAF');

  const tenantId = profile.tenant_id;

  const { data: connection } = await supabase
    .from('tenant_anaf_connections')
    .select('status, cui, token_expires_at, access_token')
    .eq('tenant_id', tenantId)
    .single();

  if (!isValidAnafConnection(connection)) {
    throw new Error('Nu ești conectat la ANAF. Mergi în Setări → Conectează cont ANAF.');
  }

  // Simulates ANAF SPV's incoming message inbox (listaMesajeFactura). In
  // production this becomes a real GET to api.anaf.ro using the stored
  // access_token, followed by a download+parse of the CIUS-RO XML per message.
  const incoming = simulateIncomingEfacturaMessage();

  const { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('cui', incoming.supplier.cui)
    .maybeSingle();

  let supplierId = existingSupplier?.id as string | undefined;
  if (supplierId) {
    // Company data on record for this CUI stays fresh with what ANAF reports.
    await supabase
      .from('suppliers')
      .update({
        name: incoming.supplier.name,
        address: incoming.supplier.address || null,
        phone: incoming.supplier.phone || null,
        email: incoming.supplier.email || null,
      })
      .eq('id', supplierId);
  } else {
    const { data: newSupplier, error: supErr } = await supabase
      .from('suppliers')
      .insert({
        tenant_id: tenantId,
        cui: incoming.supplier.cui,
        name: incoming.supplier.name,
        address: incoming.supplier.address || null,
        phone: incoming.supplier.phone || null,
        email: incoming.supplier.email || null,
      })
      .select('id')
      .single();
    if (supErr || !newSupplier) throw new Error('Eroare la înregistrarea furnizorului: ' + (supErr?.message || ''));
    supplierId = newSupplier.id;
  }

  const { data: invoice, error: invErr } = await supabase
    .from('received_invoices')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      external_id: incoming.external_id,
      number: incoming.number,
      issued_at: incoming.issued_at,
      total: incoming.total,
      status: 'new',
    })
    .select('id')
    .single();

  if (invErr || !invoice) throw new Error('Eroare la înregistrarea facturii primite: ' + (invErr?.message || ''));

  const items = incoming.items.map((i) => ({
    received_invoice_id: invoice.id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    total: i.quantity * i.unit_price,
  }));
  const { error: itemsErr } = await supabase.from('received_invoice_items').insert(items);
  if (itemsErr) throw new Error('Eroare la înregistrarea liniilor facturii: ' + itemsErr.message);

  revalidatePath('/received-invoices');
  return { success: true };
}

export async function processReceivedInvoice(invoiceId: string, markupPercentRaw: FormDataEntryValue | number) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };
  if (profile.role !== 'admin') return { error: 'Doar administratorii pot înregistra piese în stoc' };

  const parsedMarkup = nonNegativeNumber.safeParse(markupPercentRaw);
  if (!parsedMarkup.success) return { error: 'Adaos (%) invalid' };
  const markup = parsedMarkup.data;

  const tenantId = profile.tenant_id;

  const { data: invoice } = await supabase
    .from('received_invoices')
    .select('*, suppliers(name)')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .single();

  if (!invoice) return { error: 'Factura nu a fost găsită' };
  if (invoice.status === 'processed') return { error: 'Factura a fost deja înregistrată în stoc' };

  const { data: items } = await supabase
    .from('received_invoice_items')
    .select('*')
    .eq('received_invoice_id', invoiceId);

  if (!items || items.length === 0) return { error: 'Factura nu are piese' };

  const distributorName = (invoice as any).suppliers?.name || 'Furnizor necunoscut';

  for (const item of items) {
    const purchasePrice = Number(item.unit_price) || 0;
    const qty = Number(item.quantity) || 0;
    const sellingPrice = Math.round(purchasePrice * (1 + markup / 100) * 100) / 100;

    const { data: existingStock } = await supabase
      .from('part_inventory')
      .select('current_stock')
      .eq('tenant_id', tenantId)
      .eq('name', item.description)
      .eq('distributor', distributorName)
      .maybeSingle();

    const newStock = (Number(existingStock?.current_stock) || 0) + qty;

    const { data: upsertedInv } = await supabase
      .from('part_inventory')
      .upsert(
        {
          tenant_id: tenantId,
          name: item.description,
          distributor: distributorName,
          current_stock: newStock,
          last_purchase_price: purchasePrice,
        },
        { onConflict: 'tenant_id,name,distributor' }
      )
      .select('id')
      .single();

    await supabase.from('parts').insert({
      tenant_id: tenantId,
      name: item.description,
      distributor: distributorName,
      quantity: qty,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      notes: `Achiziție automată din factură primită ${invoice.number || invoice.external_id}`,
    });

    if (upsertedInv) {
      await supabase.from('received_invoice_items').update({ part_inventory_id: upsertedInv.id }).eq('id', item.id);
    }
  }

  await supabase
    .from('received_invoices')
    .update({ status: 'processed', markup_percent_applied: markup, processed_at: new Date().toISOString() })
    .eq('id', invoiceId);

  revalidatePath('/received-invoices');
  revalidatePath('/parts-inventory');
  return { success: true };
}
