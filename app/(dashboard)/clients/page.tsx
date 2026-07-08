import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import ExportButton from '@/components/ExportButton';
import { getCurrentProfile } from '@/lib/supabase/server';

async function addClient(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Profil negăsit');

  try {
    await supabase.from('clients').insert({
      tenant_id: profile.tenant_id,
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email') || null,
    });

    revalidatePath('/dashboard/clients');
  } catch (err: any) {
    console.error('[addClient error]', err);
    // Do not throw raw (can cause x-action-redirect header issues with special chars); revalidate will show state
    // For E2E we rely on visibility after click
  }
}

export default async function ClientsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', profile?.tenant_id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Clienți</h1>

      <div className="bg-white rounded-2xl p-6 mb-8">
        <h3 className="font-medium mb-4">Adaugă client nou</h3>
        <form action={addClient} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input name="name" placeholder="Nume complet" required className="border rounded-xl px-4 py-2" data-testid="client-name" />
          <input name="phone" placeholder="Telefon" required className="border rounded-xl px-4 py-2" data-testid="client-phone" />
          <input name="email" placeholder="Email (opțional)" className="border rounded-xl px-4 py-2" data-testid="client-email" />
          <button type="submit" className="bg-black text-white rounded-xl" data-testid="add-client">Adaugă</button>
        </form>
      </div>

      <div className="flex justify-end mb-2">
        <ExportButton data={clients || []} filename={`clienti_${new Date().toISOString().split('T')[0]}`} />
      </div>
      <div className="bg-white rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="text-left p-4">Nume</th>
              <th className="text-left p-4">Telefon</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Data</th>
            </tr>
          </thead>
          <tbody>
            {clients && clients.length > 0 ? (
              clients.map((client: any) => (
                <tr key={client.id} className="border-b last:border-none">
                  <td className="p-4 font-medium">{client.name}</td>
                  <td className="p-4">{client.phone}</td>
                  <td className="p-4 text-zinc-600">{client.email || '-'}</td>
                  <td className="p-4 text-zinc-500">{new Date(client.created_at).toLocaleDateString('ro-RO')}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Niciun client înregistrat încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
