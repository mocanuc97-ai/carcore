'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { simulateIncomingEfacturaMessage } from '@/lib/efactura/receive-stub';
import { isValidAnafConnection } from '@/lib/efactura/stub';
import { markupPercentSchema } from '@/lib/validation';

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
    if (supErr) {
      if (supErr.code === '23505') {
        // Lost a race to a concurrent poll that just registered this same
        // CUI — use the row it created instead of dropping this invoice.
        const { data: raceSupplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('cui', incoming.supplier.cui)
          .single();
        if (!raceSupplier) throw new Error('Eroare la înregistrarea furnizorului. Încearcă din nou.');
        supplierId = raceSupplier.id;
      } else {
        throw new Error('Eroare la înregistrarea furnizorului. Încearcă din nou.');
      }
    } else if (newSupplier) {
      supplierId = newSupplier.id;
    }
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

  if (invErr) {
    if (invErr.code === '23505') throw new Error('Factura simulată are un identificator deja folosit — încearcă din nou.');
    throw new Error('Eroare la înregistrarea facturii primite. Încearcă din nou.');
  }
  if (!invoice) throw new Error('Eroare la înregistrarea facturii primite. Încearcă din nou.');

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

  const parsedMarkup = markupPercentSchema.safeParse(markupPercentRaw);
  if (!parsedMarkup.success) return { error: parsedMarkup.error.issues.map((i) => i.message).join('; ') };
  const markup = parsedMarkup.data;

  const tenantId = profile.tenant_id;

  // Atomic claim: flips status new/error -> processed in one conditional
  // update. Only the caller whose update actually matches a row (claimed
  // !== null) proceeds to mutate stock — a concurrent double-click or a
  // second admin tab racing on the same invoice gets a clean "already
  // processed" response instead of both racing through the stock writes
  // below and double-incrementing (found via QA testing).
  const { data: claimed, error: claimErr } = await supabase
    .from('received_invoices')
    .update({ status: 'processed', markup_percent_applied: markup, processed_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .in('status', ['new', 'error'])
    .select('id, number, external_id, supplier_id')
    .maybeSingle();

  if (claimErr) return { error: 'Eroare la înregistrare: ' + claimErr.message };
  if (!claimed) return { error: 'Factura a fost deja înregistrată în stoc (sau se procesează chiar acum)' };

  const { data: supplier } = await supabase.from('suppliers').select('name').eq('id', claimed.supplier_id).maybeSingle();
  const distributorName = supplier?.name || 'Furnizor necunoscut';

  const { data: items } = await supabase
    .from('received_invoice_items')
    .select('*')
    .eq('received_invoice_id', invoiceId);

  if (!items || items.length === 0) {
    revalidatePath('/received-invoices');
    return { success: true };
  }

  for (const item of items) {
    // Idempotent retry: if a previous attempt failed partway through (see the
    // 'error' status handling below) and this is a re-run, skip items already
    // successfully registered — otherwise a retry would double-count stock for
    // whatever succeeded before the failure.
    if (item.part_inventory_id) continue;

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

    const { data: upsertedInv, error: invUpsertErr } = await supabase
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

    // Errors here were previously ignored, letting the invoice reach
    // 'processed' while the actual stock/purchase write silently failed
    // (found via QA testing with an extreme markup causing a numeric
    // overflow on insert). Mark the invoice 'error' instead so it's visibly
    // wrong and retriable, rather than a false "success".
    if (invUpsertErr || !upsertedInv) {
      await supabase.from('received_invoices').update({ status: 'error' }).eq('id', invoiceId);
      return { error: `Eroare la actualizarea stocului pentru "${item.description}". Factura a fost marcată cu eroare — poți reîncerca.` };
    }

    const { error: partsInsertErr } = await supabase.from('parts').insert({
      tenant_id: tenantId,
      name: item.description,
      distributor: distributorName,
      quantity: qty,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      notes: `Achiziție automată din factură primită ${claimed.number || claimed.external_id}`,
    });

    if (partsInsertErr) {
      await supabase.from('received_invoices').update({ status: 'error' }).eq('id', invoiceId);
      return { error: `Eroare la înregistrarea achiziției pentru "${item.description}". Factura a fost marcată cu eroare — poți reîncerca.` };
    }

    await supabase.from('received_invoice_items').update({ part_inventory_id: upsertedInv.id }).eq('id', item.id);
  }

  revalidatePath('/received-invoices');
  revalidatePath('/parts-inventory');
  return { success: true };
}
