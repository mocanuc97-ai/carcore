'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateClient(clientId: string, formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };

  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  if (!name?.trim() || !phone?.trim()) {
    return { error: 'Nume și telefon sunt obligatorii' };
  }

  const { error } = await supabase
    .from('clients')
    .update({
      name,
      phone,
      email: formData.get('email') || null,
      address: formData.get('address') || null,
      notes: formData.get('notes') || null,
    })
    .eq('id', clientId)
    .eq('tenant_id', profile.tenant_id);

  if (error) {
    console.error('[updateClient error]', error);
    return { error: error.message };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
  return { success: true };
}
