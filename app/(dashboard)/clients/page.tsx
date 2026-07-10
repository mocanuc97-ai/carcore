import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ExportButton from '@/components/ExportButton';
import IncompleteBadge from '@/components/IncompleteBadge';
import AddClientForm from '@/components/AddClientForm';
import { getClientMissingFields } from '@/lib/profile-completeness';
import { getCurrentProfile } from '@/lib/supabase/server';

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Clienți</h1>
        <Link
          href="/clients/import"
          className="text-sm px-4 py-2 border rounded-xl hover:bg-zinc-100"
          data-testid="import-clients-link"
        >
          Import din CSV
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-6 mb-8">
        <h3 className="font-medium mb-4">Adaugă client nou</h3>
        <AddClientForm />
      </div>

      <div className="flex justify-end mb-2">
        <ExportButton data={clients || []} filename={`clienti_${new Date().toISOString().split('T')[0]}`} />
      </div>
      <div className="bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="text-left p-4">Nume</th>
              <th className="text-left p-4">Tip</th>
              <th className="text-left p-4">Telefon</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Data</th>
              <th className="text-left p-4"></th>
            </tr>
          </thead>
          <tbody>
            {clients && clients.length > 0 ? (
              clients.map((client: any) => (
                <tr key={client.id} className="border-b last:border-none">
                  <td className="p-4 font-medium max-w-xs truncate" title={client.name}>
                    <Link href={`/clients/${client.id}`} className="hover:underline">{client.name}</Link>
                  </td>
                  <td className="p-4 text-zinc-600 text-xs">
                    {client.client_type === 'persoana_juridica' ? (
                      <span>Firmă{client.cui ? ` · ${client.cui}` : ''}</span>
                    ) : (
                      <span>Persoană fizică</span>
                    )}
                  </td>
                  <td className="p-4">{client.phone}</td>
                  <td className="p-4 text-zinc-600">{client.email || '-'}</td>
                  <td className="p-4 text-zinc-500">{new Date(client.created_at).toLocaleDateString('ro-RO')}</td>
                  <td className="p-4">
                    <IncompleteBadge missing={getClientMissingFields(client)} />
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Niciun client înregistrat încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
