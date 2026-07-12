'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { interventionCatalogSchema } from '@/lib/validation';

export async function addInterventionCatalogEntry(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };

  const parsed = interventionCatalogSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  // New entries go after the seeded/curated list by default; the shop can
  // still promote a custom entry by re-adding it earlier isn't supported yet,
  // but deleting the unwanted defaults + keeping only what they use achieves
  // "most common first" in practice.
  const { data: maxRow } = await supabase
    .from('intervention_catalog')
    .select('sort_order')
    .eq('tenant_id', profile.tenant_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order || 0) + 10;

  const { error } = await supabase.from('intervention_catalog').insert({
    tenant_id: profile.tenant_id,
    name: parsed.data.name,
    sort_order: nextSortOrder,
  });

  if (error) {
    if (error.code === '23505') return { error: 'Acest tip de intervenție există deja în listă' };
    return { error: error.message };
  }

  revalidatePath('/interventions');
  return { success: true };
}

export async function deleteInterventionCatalogEntry(id: string) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };

  const { error } = await supabase
    .from('intervention_catalog')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath('/interventions');
  return { success: true };
}
