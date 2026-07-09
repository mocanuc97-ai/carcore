'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return;

  const year = formData.get('year');
  const mileage = formData.get('mileage');

  try {
    await supabase
      .from('vehicles')
      .update({
        make: formData.get('make'),
        model: formData.get('model'),
        year: year ? parseInt(year as string) : null,
        vin: formData.get('vin') || null,
        license_plate: formData.get('license_plate') || null,
        mileage: mileage ? parseInt(mileage as string) : null,
        color: formData.get('color') || null,
      })
      .eq('id', vehicleId)
      .eq('tenant_id', profile.tenant_id);

    revalidatePath(`/vehicles/${vehicleId}`);
    revalidatePath('/vehicles');
  } catch (err) {
    console.error('[updateVehicle error]', err);
  }
}
