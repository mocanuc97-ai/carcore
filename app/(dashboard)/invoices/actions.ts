'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateInvoicePDF } from '@/lib/invoice/generate';
import { getResendClient } from '@/lib/resend/client';
import { revalidatePath } from 'next/cache';
import { parseAndValidateInvoiceParts, parseAndValidateInvoiceLabor } from '@/lib/validation';

export async function createAndSendInvoice(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nu ești autentificat');

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profil negăsit');
    if (profile.role !== 'admin') {
      throw new Error('Doar administratorii pot crea facturi cu e-Factura/ANAF. (Recepție: folosește alte fluxuri)');
    }

    const tenantId = profile.tenant_id;
  const vehicleId = (formData.get('vehicle_id') as string) || null;
  const serviceIds = formData.getAll('service_ids') as string[];
  const interventionId = formData.get('intervention_id') as string | null;

  if (!vehicleId) throw new Error('Selectează o mașină pentru a identifica clientul');

  // Client is derived server-side from the vehicle (never trust a client_id
  // sent directly from the form) — this is the actual "auto-detect client
  // from selected vehicle" behavior, not just a UI convenience.
  const { data: vehicleForInvoice } = await supabase
    .from('vehicles')
    .select('id, client_id')
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)
    .single();
  if (!vehicleForInvoice) throw new Error('Mașina selectată nu a fost găsită');
  const clientId = vehicleForInvoice.client_id as string;

  // Support for purchased parts from distributors
  const partNames = formData.getAll('part_name') as string[];
  const partPrices = formData.getAll('part_price') as string[];
  const partQtys = formData.getAll('part_qty') as string[];
  const partCosts = formData.getAll('part_cost') as string[];

  // Validate parts early with Zod (prevents negative/zero/NaN from client bypass)
  const { items: manualPartLines, errors: partErrors } = parseAndValidateInvoiceParts(
    partNames,
    partQtys,
    partPrices,
    partCosts
  );
  if (partErrors.length > 0) {
    throw new Error('Eroare validare piese: ' + partErrors.join(' | '));
  }

  // Historical parts selected from client interventions (via checkboxes) - use separate keys to avoid being treated as manual for deduction
  const histPartNames = formData.getAll('hist_part_name') as string[];
  const histPartPrices = formData.getAll('hist_part_price') as string[];
  const histPartQtys = formData.getAll('hist_part_qty') as string[];
  const histPartCosts = formData.getAll('hist_part_cost') as string[];
  const { items: histPartLines, errors: histErrors } = parseAndValidateInvoiceParts(
    histPartNames,
    histPartQtys,
    histPartPrices,
    histPartCosts
  );
  if (histErrors.length > 0) {
    throw new Error('Eroare validare piese istorice: ' + histErrors.join(' | '));
  }

  // Labor ("manoperă") lines — hours x rate, no stock/inventory involvement
  const laborHours = formData.getAll('labor_hours') as string[];
  const laborRates = formData.getAll('labor_rate') as string[];
  const { items: laborLines, errors: laborErrors } = parseAndValidateInvoiceLabor(laborHours, laborRates);
  if (laborErrors.length > 0) {
    throw new Error('Eroare validare manoperă: ' + laborErrors.join(' | '));
  }

  // Fetch client
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  // Fetch tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  // Fetch selected services
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .in('id', serviceIds);

  // Build part lines (manual + historical client parts + from intervention if provided)
  // manualPartLines: direct manual entries => will deduct stock
  // hist + intParts: already deducted when added to intervention => no double deduct
  const partLines: any[] = [...manualPartLines, ...histPartLines];

  // Auto-add parts from intervention (DB values assumed clean, but coerce to positive for safety)
  if (interventionId) {
    const { data: intParts } = await supabase
      .from('parts')
      .select('*')
      .eq('intervention_id', interventionId);
    if (intParts) {
      intParts.forEach((p: any) => {
        const q = Number(p.quantity) || 0;
        const up = Number(p.selling_price) || 0;
        if (q > 0 && up > 0) {
          partLines.push({
            description: `[Piesă] ${p.name}`,
            quantity: q,
            unit_price: up,
            cost: Number(p.purchase_price) || 0,
            total: q * up,
          });
        }
      });
    }
  }

  // Ensure at least one service, part, or labor line (critical for invoice creation)
  const hasServices = services && services.length > 0;
  const hasParts = partLines.length > 0;
  const hasLabor = laborLines.length > 0;
  if (!hasServices && !hasParts && !hasLabor) {
    throw new Error('Trebuie să selectezi cel puțin un serviciu, o piesă sau manoperă');
  }

  // Additional guard: filter out any invalid priced items that might sneak in
  const validPartLines = partLines.filter((p: any) => Number(p.quantity) > 0 && Number(p.unit_price) > 0);
  const validLaborLines = laborLines.filter((l) => Number(l.quantity) > 0 && Number(l.unit_price) > 0);

  // Filter services with valid positive price too
  const validServices = (services || []).filter((s: any) => Number(s.price) > 0);

  const servicesTotal = validServices.reduce((sum, s) => sum + Number(s.price), 0);
  const partsTotal = validPartLines.reduce((sum, p) => sum + p.total, 0);
  const laborTotal = validLaborLines.reduce((sum, l) => sum + l.total, 0);
  const total = servicesTotal + partsTotal + laborTotal;

  // Re-check after filtering (in case only invalid items were sent)
  if (validServices.length === 0 && validPartLines.length === 0 && validLaborLines.length === 0) {
    throw new Error('Trebuie să selectezi cel puțin un serviciu, o piesă sau manoperă cu preț/cantitate pozitivă');
  }

  // Create invoice
  const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      vehicle_id: vehicleId,
      number: invoiceNumber,
      total,
      status: 'sent',
    })
    .select()
    .single();

  if (invError || !invoice) {
    throw new Error(invError?.message || 'Eroare la crearea facturii');
  }

  // Create invoice items (services + parts + labor)
  const serviceItems = validServices.map((s: any) => ({
    invoice_id: invoice.id,
    service_id: s.id,
    description: s.name,
    quantity: 1,
    unit_price: s.price,
    total: s.price,
  }));

  // invoice_items has no `cost` column (cost/margin is tracked separately via
  // parts/part_inventory) — this previously included one anyway, which made
  // the whole insert below fail silently on ANY invoice with parts, since a
  // batch insert with an unknown column is rejected atomically and the error
  // was never checked (found while adding labor line items to this action).
  const partItems = validPartLines.map((p: any) => ({
    invoice_id: invoice.id,
    service_id: null,
    description: p.description,
    quantity: p.quantity,
    unit_price: p.unit_price,
    total: p.total,
  }));

  const laborItems = validLaborLines.map((l) => ({
    invoice_id: invoice.id,
    service_id: null,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    total: l.total,
  }));

  const { error: itemsError } = await supabase.from('invoice_items').insert([...serviceItems, ...partItems, ...laborItems]);
  if (itemsError) {
    console.error('[createAndSendInvoice invoice_items error]', itemsError);
    throw new Error('Eroare la salvarea liniilor facturii: ' + itemsError.message);
  }

  // Deduct stock ONLY for manually-entered parts at invoice creation time (by name, matching prior logic).
  // - Intervention-sourced and historical client parts: stock already deducted in add-part-action.ts when added to intervention
  //   (this structural separation + pre-check prevents double deduction)
  // - Pre-verify current_stock >= qty ; use conditional .eq(current_stock) update for optimistic concurrency (simulates tx safety)
  // - A part name can have multiple rows (one per distributor, e.g. one manually
  //   purchased + one registered from a received supplier invoice) — manual entry
  //   has no distributor field, so we must sum across all rows for that name and
  //   deduct greedily row-by-row, not assume a single row (found via QA testing:
  //   .single() on 2+ rows errored, silently skipping deduction entirely).
  for (const p of manualPartLines) {
    const partName = p.description.replace('[Piesă] ', '');
    const qty = Number(p.quantity) || 0;
    const { data: invRows } = await supabase
      .from('part_inventory')
      .select('id, current_stock')
      .eq('tenant_id', tenantId)
      .eq('name', partName);

    if (invRows && invRows.length > 0) {
      const totalAvailable = invRows.reduce((sum, r) => sum + (Number(r.current_stock) || 0), 0);
      if (totalAvailable < qty) {
        throw new Error(`Stoc insuficient pentru "${partName}" (disponibil: ${totalAvailable}, cerut: ${qty}). Deductie anulata.`);
      }

      let remaining = qty;
      for (const row of invRows) {
        if (remaining <= 0) break;
        const current = Number(row.current_stock) || 0;
        if (current <= 0) continue;
        const deduct = Math.min(current, remaining);
        const { data: updatedRows, error: updateErr } = await supabase
          .from('part_inventory')
          .update({ current_stock: current - deduct })
          .eq('id', row.id)
          .eq('current_stock', current)
          .select('current_stock');
        if (updateErr || !updatedRows || updatedRows.length === 0) {
          throw new Error(`Eroare la deducerea stocului pentru "${partName}" (stoc modificat concurent sau conditie esuata).`);
        }
        remaining -= deduct;
      }
      if (remaining > 0) {
        throw new Error(`Stoc insuficient pentru "${partName}" (stoc modificat concurent în timpul facturării).`);
      }
    }
  }

  // Generate professional PDF
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateInvoicePDF({
      invoice: {
        number: invoice.number,
        issued_at: invoice.issued_at,
        total: Number(invoice.total),
      },
      client: {
        name: client.name,
        phone: client.phone,
        email: client.email || undefined,
      },
      tenant: {
        name: tenant.name,
        phone: tenant.phone || undefined,
        email: tenant.email || undefined,
        address: tenant.address || undefined,
        logo_url: tenant.logo_url || undefined,
      },
      items: [...serviceItems, ...partItems, ...laborItems].map((i: any) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total: Number(i.total),
      })),
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
  }

  // Upload PDF to storage
  let pdfUrl: string | null = null;
  if (pdfBuffer) {
    const pdfPath = `${tenantId}/invoices/${invoice.number}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from('intervention-photos')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (!uploadErr) {
      const { data: urlData } = admin.storage
        .from('intervention-photos')
        .getPublicUrl(pdfPath);
      pdfUrl = urlData.publicUrl;

      await supabase
        .from('invoices')
        .update({ pdf_url: pdfUrl })
        .eq('id', invoice.id);
    }
  }

  // Send email with PDF attachment
  const resend = getResendClient();
  if (client.email && resend) {
    try {
      const attachments = pdfBuffer
        ? [
            {
              filename: `${invoice.number}.pdf`,
              content: pdfBuffer,
            },
          ]
        : [];

      await resend.emails.send({
        from: 'facturi@carcore.ro',
        to: client.email,
        subject: `Factură ${invoice.number} - ${tenant.name}`,
        text: `Bună ${client.name},\n\nÎți atașăm factura nr. ${invoice.number} în valoare de ${total} RON.\n\nMulțumim pentru colaborare!`,
        attachments,
      });
    } catch (emailErr) {
      console.error('Resend error:', emailErr);
    }
  }

  revalidatePath('/invoices');
  } catch (err: any) {
    console.error('[createAndSendInvoice error]', err);
    throw new Error(err.message || 'Eroare la crearea facturii');
  }

  // No redirect() here: this action is invoked as a direct client-side call
  // (not a <form action>), so redirect()'s special throw would cross the
  // server/client boundary and get caught by the caller's own try/catch,
  // showing "NEXT_REDIRECT" as a false error even on success. The caller
  // (invoices/new/page.tsx) navigates to /invoices itself after a successful await.
}
