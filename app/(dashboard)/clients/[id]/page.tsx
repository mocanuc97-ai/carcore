import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import Link from 'next/link';
import IncompleteBadge from '@/components/IncompleteBadge';
import ClientEditForm from '@/components/ClientEditForm';
import { getClientMissingFields, getVehicleMissingFields } from '@/lib/profile-completeness';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (!client) {
    return <div>Clientul nu a fost găsit sau acces refuzat.</div>;
  }

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('client_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  const missing = getClientMissingFields(client);

  return (
    <div>
      <Link href="/clients" className="text-sm text-blue-600">← Înapoi la clienți</Link>

      <div className="flex items-center gap-3 mt-4">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <IncompleteBadge missing={missing} />
      </div>

      <div className="bg-white rounded-2xl p-6 mt-6 max-w-2xl">
        <h3 className="font-medium mb-4">Editează datele clientului</h3>
        <ClientEditForm
          clientId={client.id}
          name={client.name}
          phone={client.phone}
          email={client.email || ''}
          address={client.address || ''}
          notes={client.notes || ''}
        />
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-3">Mașini ({vehicles?.length || 0})</h2>
        <div className="bg-white rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50">
                <th className="text-left p-4">Marcă / Model</th>
                <th className="text-left p-4">VIN</th>
                <th className="text-left p-4">Nr. înmatriculare</th>
                <th className="text-left p-4"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles && vehicles.length > 0 ? vehicles.map((v) => (
                <tr key={v.id} className="border-b last:border-none">
                  <td className="p-4">
                    <Link href={`/vehicles/${v.id}`} className="hover:underline font-medium">
                      {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                    </Link>
                  </td>
                  <td className="p-4 font-mono text-xs">{v.vin || '-'}</td>
                  <td className="p-4">{v.license_plate || '-'}</td>
                  <td className="p-4"><IncompleteBadge missing={getVehicleMissingFields(v)} /></td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Nicio mașină înregistrată pentru acest client.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
