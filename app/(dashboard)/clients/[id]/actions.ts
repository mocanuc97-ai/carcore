'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateClient(clientId: string, formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return;

  try {
    await supabase
      .from('clients')
      .update({
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email') || null,
        address: formData.get('address') || null,
        notes: formData.get('notes') || null,
      })
      .eq('id', clientId)
      .eq('tenant_id', profile.tenant_id);

    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/clients');
  } catch (err) {
    console.error('[updateClient error]', err);
  }
}
