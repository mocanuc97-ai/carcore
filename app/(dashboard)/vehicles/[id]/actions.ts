'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { vehicleSchema } from '@/lib/validation';

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat' };

  const parsed = vehicleSchema.safeParse({
    make: formData.get('make'),
    model: formData.get('model'),
    year: formData.get('year'),
    mileage: formData.get('mileage'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const { error } = await supabase
    .from('vehicles')
    .update({
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year ?? null,
      vin: formData.get('vin') || null,
      license_plate: formData.get('license_plate') || null,
      mileage: parsed.data.mileage ?? null,
      color: formData.get('color') || null,
    })
    .eq('id', vehicleId)
    .eq('tenant_id', profile.tenant_id);

  if (error) {
    console.error('[updateVehicle error]', error);
    return { error: error.message };
  }

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath('/vehicles');
  return { success: true };
}
