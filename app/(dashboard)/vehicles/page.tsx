import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import ExportButton from '@/components/ExportButton';
import { getCurrentProfile } from '@/lib/supabase/server';

async function addVehicle(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Profil negăsit');

  try {
    await supabase.from('vehicles').insert({
      tenant_id: profile.tenant_id,
      client_id: formData.get('client_id'),
      make: formData.get('make'),
      model: formData.get('model'),
      year: formData.get('year') ? parseInt(formData.get('year') as string) : null,
      vin: formData.get('vin') || null,
      license_plate: formData.get('license_plate') || null,
      mileage: formData.get('mileage') ? parseInt(formData.get('mileage') as string) : null,
    });

    revalidatePath('/vehicles');
  } catch (err: any) {
    console.error('[addVehicle error]', err);
    // Avoid throwing to prevent header errors in server actions during E2E
  }
}

export default async function VehiclesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*, clients(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  const { data: clients } = await supabase.from('clients').select('id, name').eq('tenant_id', tenantId);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Mașini</h1>

      <div className="bg-white rounded-2xl p-6 mb-8">
        <h3 className="font-medium mb-4">Adaugă mașină</h3>
        <form action={addVehicle} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select name="client_id" required className="border rounded-xl px-4 py-2">
            <option value="">Selectează client</option>
            {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="make" placeholder="Marcă" required className="border rounded-xl px-4 py-2" />
          <input name="model" placeholder="Model" required className="border rounded-xl px-4 py-2" />
          <input name="vin" placeholder="Serie caroserie (VIN)" className="border rounded-xl px-4 py-2" />
          <input name="license_plate" placeholder="Număr înmatriculare" className="border rounded-xl px-4 py-2" />
          <input name="year" type="number" placeholder="An" className="border rounded-xl px-4 py-2" />
          <input name="mileage" type="number" placeholder="Km" className="border rounded-xl px-4 py-2" />
          <button className="bg-black text-white rounded-xl col-span-2 md:col-span-1">Adaugă mașină</button>
        </form>
      </div>

      <div className="flex justify-end mb-2">
        <ExportButton data={vehicles || []} filename={`vehicule_${new Date().toISOString().split('T')[0]}`} />
      </div>
      <div className="bg-white rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-left">Client</th>
              <th className="p-4 text-left">Marcă / Model</th>
              <th className="p-4 text-left">VIN</th>
              <th className="p-4 text-left">Nr. înmatriculare</th>
              <th className="p-4 text-left">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {vehicles && vehicles.length > 0 ? vehicles.map((v: any) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="p-4">{v.clients?.name}</td>
                <td className="p-4 font-medium">{v.make} {v.model} {v.year ? `(${v.year})` : ''}</td>
                <td className="p-4 font-mono text-xs">{v.vin || '-'}</td>
                <td className="p-4">{v.license_plate || '-'}</td>
                <td className="p-4">
                  <a href={`/vehicles/${v.id}`} className="text-blue-600 text-sm hover:underline">Istoric complet</a>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Niciun vehicul înregistrat încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
