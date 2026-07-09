'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { partToInterventionSchema } from '@/lib/validation';

export async function addPartToIntervention(formData: FormData) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nu ești autentificat');
    const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single();
    if (!profile) throw new Error('Profil negăsit');
    // reception can add parts too (not restricted like ANAF)

  const raw = {
    intervention_id: formData.get('intervention_id'),
    name: formData.get('name'),
    distributor: formData.get('distributor'),
    qty: formData.get('qty'),
    purchase_price: formData.get('purchase_price'),
    selling_price: formData.get('selling_price'),
  };

  const parsed = partToInterventionSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(e => e.message).join('; ');
    throw new Error('Validare eșuată: ' + msg);
  }

  const { intervention_id: interventionId, name, distributor, qty, purchase_price: purchase, selling_price: selling } = parsed.data;

  // Get vehicle from intervention
  const { data: int } = await supabase.from('interventions').select('vehicle_id').eq('id', interventionId).single();

  await supabase.from('parts').insert({
    tenant_id: profile.tenant_id,
    intervention_id: interventionId,
    vehicle_id: int?.vehicle_id,
    name,
    distributor: distributor || null,
    quantity: qty,
    purchase_price: purchase,
    selling_price: selling,
  });

  // Pre-check stock before deduction to prevent negative/0 or over-deduction
  // Use conditional update (optimistic lock on current_stock) to simulate atomicity / avoid races
  const { data: inv } = await supabase
    .from('part_inventory')
    .select('current_stock')
    .eq('tenant_id', profile.tenant_id)
    .eq('name', name)
    .eq('distributor', distributor || '')
    .single();

  if (inv) {
    const current = Number(inv.current_stock) || 0;
    if (current < qty) {
      throw new Error(`Stoc insuficient pentru "${name}" (disponibil: ${current}, cerut: ${qty}). Deductie anulata.`);
    }
    const newStock = current - qty;
    // Conditional update: only succeeds if stock still exactly matches what we read (guards double deduct / concurrent)
    const { data: updatedRows, error: updateErr } = await supabase
      .from('part_inventory')
      .update({ current_stock: newStock })
      .eq('tenant_id', profile.tenant_id)
      .eq('name', name)
      .eq('distributor', distributor || '')
      .eq('current_stock', current)
      .select('current_stock');
    if (updateErr || !updatedRows || updatedRows.length === 0) {
      throw new Error(`Eroare la deducerea stocului pentru "${name}" (stoc modificat concurent sau insuficient).`);
    }
  }

  revalidatePath('/interventions');
  revalidatePath('/parts-inventory');
  } catch (err: any) {
    console.error('[addPartToIntervention error]', err);
    throw new Error(err.message || 'Eroare la adăugare piesă');
  }
}
