'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { clientSchema, vehicleSchema } from '@/lib/validation';

export async function addVehicleToClient(clientId: string, formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };

  // Defense in depth: verify the client actually belongs to this tenant
  // before attaching a vehicle to it (RLS also enforces this on the vehicles
  // table itself, but that surfaces as an opaque RLS error — this gives a
  // clean message instead of leaking a raw Postgres error to the toast).
  const { data: ownedClient } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle();
  if (!ownedClient) return { error: 'Client negăsit' };

  const parsed = vehicleSchema.safeParse({
    make: formData.get('make'),
    model: formData.get('model'),
    year: formData.get('year'),
    mileage: formData.get('mileage'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map(i => i.message).join('; ') };
  }

  const { error } = await supabase.from('vehicles').insert({
    tenant_id: profile.tenant_id,
    client_id: clientId,
    make: parsed.data.make,
    model: parsed.data.model,
    year: parsed.data.year ?? null,
    vin: formData.get('vin') || null,
    license_plate: formData.get('license_plate') || null,
    mileage: parsed.data.mileage ?? null,
  });

  if (error) {
    console.error('[addVehicleToClient error]', error);
    return { error: error.message };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/vehicles');
  return { success: true };
}

export async function updateClient(clientId: string, formData: FormData) {
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
    return { error: parsed.error.issues.map(i => i.message).join('; ') };
  }

  const { error } = await supabase
    .from('clients')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      notes: formData.get('notes') || null,
      client_type: parsed.data.client_type,
      cui: parsed.data.client_type === 'persoana_juridica' ? parsed.data.cui : null,
      reg_com: parsed.data.client_type === 'persoana_juridica' ? parsed.data.reg_com : null,
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
