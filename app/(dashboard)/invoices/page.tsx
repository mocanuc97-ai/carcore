import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { sendToEfactura } from './efactura-actions';
import { checkEfacturaStatusAction } from './check-efactura-action';
import { pollAllPendingEfactura } from './poll-all-efactura';
import ExportButton from '@/components/ExportButton';
import { isValidAnafConnection } from '@/lib/efactura/stub';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function InvoicesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, clients(name)')
    .eq('tenant_id', tenantId)
    .order('issued_at', { ascending: false });

  const { data: connection } = tenantId ? await supabase.from('tenant_anaf_connections').select('status, cui, token_expires_at, access_token').eq('tenant_id', tenantId).single() : { data: null };
  const isConnected = isValidAnafConnection(connection);
  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Facturi</h1>
        <div className="flex gap-2">
          <ExportButton data={invoices || []} filename={`facturi_${new Date().toISOString().split('T')[0]}`} label="Export CSV" />
          {isAdmin && (
            <form action={async () => { 'use server'; await pollAllPendingEfactura(); }}>
              <button 
                type="submit"
                className="bg-white border px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Verifică toate statusurile ANAF
              </button>
            </form>
          )}
          <Link
            href="/invoices/new"
            className="bg-black text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-zinc-900"
          >
            + Factură nouă
          </Link>
        </div>
      </div>

      {isAdmin && !isConnected && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
          Nu ești conectat la ANAF e-Factura.{' '}
          <Link href="/settings" className="underline text-yellow-700 font-medium">Conectează-te din Setări</Link> pentru a trimite facturi direct la ANAF.
        </div>
      )}
      {!isAdmin && (
        <div className="mb-4 p-2 text-xs text-zinc-500">Recepție: acțiunile e-Factura/ANAF sunt ascunse (doar admin).</div>
      )}

      <div className="bg-white rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="p-4 text-left">Număr</th>
              <th className="p-4 text-left">Client</th>
              <th className="p-4 text-left">Total</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">PDF</th>
              {isAdmin && <th className="p-4 text-left">e-Factura Status</th>}
              {isAdmin && <th className="p-4 text-left">Acțiuni ANAF</th>}
            </tr>
          </thead>
          <tbody>
            {invoices && invoices.length > 0 ? (
              invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="p-4 font-mono text-xs">{inv.number}</td>
                  <td className="p-4">{inv.clients?.name}</td>
                  <td className="p-4 font-medium">{inv.total} RON</td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {inv.pdf_url ? (
                      <a href={inv.pdf_url} target="_blank" className="text-blue-600 hover:underline text-sm">
                        Descarcă
                      </a>
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-4">
                      {(() => {
                        const status = inv.efactura_status || 'pending';
                        const colors: any = {
                          pending: 'bg-gray-100 text-gray-700',
                          sent: 'bg-blue-100 text-blue-700',
                          in_processing: 'bg-yellow-100 text-yellow-700',
                          accepted: 'bg-green-100 text-green-700',
                          rejected: 'bg-red-100 text-red-700',
                          error: 'bg-red-100 text-red-700',
                        };
                        return (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status] || 'bg-gray-100'}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                  )}

                  {isAdmin && (
                    <td className="p-4 flex items-center gap-2">
                      {isConnected ? (
                        <>
                          {['pending', 'error'].includes(inv.efactura_status) && (
                            <form action={async () => { 'use server'; await sendToEfactura(inv.id); }}>
                              <button className="text-xs px-2 py-1 rounded border hover:bg-blue-50 text-blue-700">Trimite ANAF</button>
                            </form>
                          )}

                          {inv.efactura_status === 'in_processing' && (
                            <form action={async () => { 'use server'; await checkEfacturaStatusAction(inv.id); }}>
                              <button className="text-xs px-2 py-1 rounded border hover:bg-green-50 text-green-700">Verifică</button>
                            </form>
                          )}

                          <a 
                            href={`/api/invoices/${inv.id}/efactura-xml`} 
                            download
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50 text-gray-700"
                            title="Export XML pentru e-Factura"
                          >
                            XML
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400">Conectează ANAF</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 7 : 5} className="p-8 text-center text-zinc-500">
                  Nicio factură înregistrată încă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
