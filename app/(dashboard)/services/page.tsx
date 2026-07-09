import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { serviceSchema } from '@/lib/validation';
import { getCurrentProfile } from '@/lib/supabase/server';

async function addService(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Profil negăsit');

  try {
    const raw = {
      name: formData.get('name'),
      price: formData.get('price'),
      duration_minutes: formData.get('duration') || null,
    };

    const parsed = serviceSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => e.message).join('; ');
      throw new Error('Validare eșuată: ' + msg);
    }

    await supabase.from('services').insert({
      tenant_id: profile.tenant_id,
      name: parsed.data.name,
      price: parsed.data.price,
      duration_minutes: parsed.data.duration_minutes ?? null,
    });

    revalidatePath('/services');
  } catch (err: any) {
    console.error('[addService error]', err);
    throw new Error(err.message || 'Eroare la adăugare serviciu');
  }
}

export default async function ServicesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', profile?.tenant_id)
    .order('name');

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Servicii &amp; Prețuri prestabilite</h1>

      <div className="bg-white rounded-2xl p-6 mb-8">
        <h3 className="font-medium mb-4">Adaugă serviciu nou</h3>
        <form action={addService} className="flex flex-wrap gap-3">
          <input name="name" placeholder="Nume serviciu" required minLength={1} className="border rounded-xl px-4 py-2 flex-1 min-w-[200px]" />
          <input name="price" type="number" step="0.01" min="0.01" placeholder="Preț (RON)" required className="border rounded-xl px-4 py-2 w-32" />
          <input name="duration" type="number" min="1" step="1" placeholder="Minute" className="border rounded-xl px-4 py-2 w-28" />
          <button className="bg-black text-white px-6 rounded-xl">Adaugă</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl p-2">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-zinc-500 border-b">
              <th className="p-4">Serviciu</th>
              <th className="p-4">Preț</th>
              <th className="p-4">Durată</th>
            </tr>
          </thead>
          <tbody>
            {services?.map((s: any) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-4">{s.name}</td>
                <td className="p-4 font-medium">{s.price} RON</td>
                <td className="p-4 text-zinc-500">{s.duration_minutes ? `${s.duration_minutes} min` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!services || services.length === 0) && <div className="p-6 text-center text-zinc-500">Niciun serviciu înregistrat încă.</div>}
      </div>
    </div>
  );
}
