import { createClient } from '@/lib/supabase/server';
import { sendAppointmentReminder } from './appointments/actions';
import { sendUnpaidInvoiceReminders } from './reminders';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function DashboardHome() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;

  const { count: clientsCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  const { data: upcomingAppointments } = await supabase
    .from('appointments')
    .select('id, scheduled_at, clients(name)')
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5);

  // Quick parts margin calculation
  const { data: recentParts } = await supabase
    .from('parts')
    .select('quantity, purchase_price, selling_price')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20);

  const totalMargin = (recentParts || []).reduce((sum, p: any) => {
    return sum + ((p.selling_price - p.purchase_price) * p.quantity);
  }, 0);

  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Bun venit, {profile?.full_name}!</h1>
      <p className="text-zinc-600 mb-8">Service: {(profile as any)?.tenants?.name} {isAdmin ? '' : '(recepție)'}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="text-sm text-zinc-500">Clienți total</div>
          <div className="text-4xl font-semibold mt-2">{clientsCount || 0}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="text-sm text-zinc-500">Programări în 7 zile</div>
          <div className="text-4xl font-semibold mt-2">{upcomingAppointments?.length || 0}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="text-sm text-zinc-500">Marjă piese recente</div>
          <div className="text-4xl font-semibold mt-2 text-green-600">{totalMargin.toFixed(0)} RON</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="text-sm text-zinc-500">Rol</div>
          <div className="text-2xl font-medium mt-2 capitalize">{profile?.role}</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-white p-4 rounded-xl">
          <strong>Flux recomandat:</strong><br />
          1. Adaugă clienți + mașini<br />
          2. Adaugă servicii cu prețuri<br />
          3. Înregistrează intervenții + piese de la distribuitori<br />
          4. Creează programări + reminder<br />
          5. Emite facturi (servicii + piese, PDF + email + e-Factura)
        </div>
        <div className="bg-white p-4 rounded-xl text-zinc-600">
          e-Factura și SMS în modul stub (pregătite). Adaugă chei în .env pentru real.<br />
          <a href="/dashboard/reports" className="underline">Vezi rapoarte</a> | <a href="/dashboard/parts-inventory" className="underline">Stoc piese</a>
        </div>
      </div>

      {/* Quick parts margin */}
      <div className="mt-6 bg-white rounded-2xl p-4">
        <div className="text-sm font-medium mb-2">Marjă piese (ultimele)</div>
        <div className="text-xs text-zinc-500">Vezi detalii în intervenții / facturi. (Calcul marjă = vânzare - achiziție)</div>
      </div>

      {/* Automatic reminders */}
      <div className="mt-4 flex gap-2">
        <form action={async () => { 'use server'; await sendUnpaidInvoiceReminders(); }}>
          <button type="submit" className="text-sm px-4 py-2 border rounded-xl hover:bg-zinc-100">
            Trimite reminder-uri automate pentru facturi neplătite
          </button>
        </form>
        {isAdmin && (
          <form action={async () => { 'use server'; await (await import('./invoices/poll-all-efactura')).pollAllPendingEfactura(); }}>
            <button type="submit" className="text-sm px-4 py-2 border rounded-xl hover:bg-zinc-100">
              Rulează poll e-Factura + reminder (simulare cron zilnic)
            </button>
          </form>
        )}
      </div>

      {upcomingAppointments && upcomingAppointments.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold mb-3">Programări apropiate - trimite reminder rapid</h3>
          <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
            {upcomingAppointments.map((a: any) => (
              <form key={a.id} action={async () => { 'use server'; await sendAppointmentReminder(a.id); }} className="flex justify-between items-center">
                <span>{a.clients?.name} — {new Date(a.scheduled_at).toLocaleDateString('ro-RO')}</span>
                <button type="submit" className="text-xs border px-3 py-1 rounded hover:bg-zinc-50">Trimite reminder</button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
