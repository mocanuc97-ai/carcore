'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { clientSchema } from '@/lib/validation';

export async function addClient(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };

  const parsed = clientSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    address: formData.get('address'),
    client_type: formData.get('client_type'),
    cui: formData.get('cui'),
    reg_com: formData.get('reg_com'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const { error } = await supabase.from('clients').insert({
    tenant_id: profile.tenant_id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email,
    address: parsed.data.address,
    client_type: parsed.data.client_type,
    cui: parsed.data.client_type === 'persoana_juridica' ? parsed.data.cui : null,
    reg_com: parsed.data.client_type === 'persoana_juridica' ? parsed.data.reg_com : null,
  });

  if (error) {
    console.error('[addClient error]', error);
    return { error: error.message };
  }

  revalidatePath('/clients');
  return { success: true };
}
