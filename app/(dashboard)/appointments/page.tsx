'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Calendar from '@/components/Calendar';
import { sendAppointmentReminder, createAppointment, updateAppointmentStatus } from './actions';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  notes?: string;
  clients: { name: string; email?: string };
  vehicles: { make: string; model: string; license_plate: string };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Server actions revalidatePath('/appointments'), but this page fetches its
  // data client-side, which revalidatePath does not touch — so it must be
  // re-run explicitly after every mutation (create, status change) or the UI
  // shows stale data until a manual reload.
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let tenantId: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      tenantId = prof?.tenant_id || null;
    }

    let apptsQuery = supabase
      .from('appointments')
      .select('*, clients(name, email), vehicles(make, model, license_plate)')
      .order('scheduled_at', { ascending: true });
    if (tenantId) apptsQuery = apptsQuery.eq('tenant_id', tenantId);
    const { data: appts } = await apptsQuery;
    if (appts) setAppointments(appts as any);

    let clQuery = supabase.from('clients').select('id, name');
    if (tenantId) clQuery = clQuery.eq('tenant_id', tenantId);
    const { data: cl } = await clQuery;
    if (cl) setClients(cl);

    let vehQuery = supabase.from('vehicles').select('id, make, model, license_plate, client_id');
    if (tenantId) vehQuery = vehQuery.eq('tenant_id', tenantId);
    const { data: veh } = await vehQuery;
    if (veh) setVehicles(veh);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAppointments = selectedDate 
    ? appointments.filter(a => {
        // Consistent local date compare for UI filter (matches Calendar's local day keys).
        // For ICS/scheduled_at: UTC used (toISOString in exportToICS + date handling).
        // DST note: use local getFullYear/Month/Date or format for calendar days to avoid tz offset on selectedDate.toISOString();
        // e.g. in UTC+3, local 2026-07-08 00:00 -> iso may roll to prev. Test DST transitions.
        const d = new Date(a.scheduled_at);
        const apptDay = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const sel = selectedDate;
        const selDay = `${sel.getFullYear()}-${String(sel.getMonth()+1).padStart(2,'0')}-${String(sel.getDate()).padStart(2,'0')}`;
        return apptDay === selDay;
      })
    : appointments;

  const exportToCSV = () => {
    const dataToExport = filteredAppointments.length > 0 ? filteredAppointments : appointments;
    if (dataToExport.length === 0) return;

    // Size guard + chunking note (consistent with ExportButton)
    const MAX_ROWS = 10000;
    if (dataToExport.length > MAX_ROWS) {
      toast.error(`Export prea mare (${dataToExport.length} > ${MAX_ROWS}). Filtrează. Chunking server-side recomandat pentru seturi mari.`);
      return;
    }

    const headers = ['Data', 'Client', 'Vehicul', 'Status', 'Note'];

    const escapeCSV = (val: any): string => {
      if (val == null) return '""';
      let str = String(val);
      const needsQuote = /["\n,]/.test(str);
      str = str.replace(/"/g, '""');
      return needsQuote || true ? `"${str}"` : str; // always quote
    };

    const rows = dataToExport.map(a => [
      new Date(a.scheduled_at).toLocaleString('ro-RO'),
      a.clients?.name || '',
      `${a.vehicles?.make} ${a.vehicles?.model} (${a.vehicles?.license_plate})`,
      a.status,
      a.notes || ''
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    const csvDate = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}` : 'toate';
    link.setAttribute('download', `programari_${csvDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exportat ${dataToExport.length} rânduri CSV`);
  };

  const exportToICS = () => {
    const dataToExport = filteredAppointments.length > 0 ? filteredAppointments : appointments;
    if (dataToExport.length === 0) return;

    // Size guard for ICS too
    if (dataToExport.length > 5000) {
      toast.error('Prea multe programări pentru ICS. Export limitat sau filtrează.');
      return;
    }

    // ICS escaping per RFC 5545: \, ; , \n  (consistent UTC dates)
    const escapeICS = (str: string | null | undefined): string => {
      return String(str || '')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r?\n/g, '\\n');
    };

    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//CarCore//Appointments//RO\n';
    dataToExport.forEach(a => {
      // Use toISOString() for UTC consistent representation (avoids local tz/DST skew in ICS)
      const scheduled = new Date(a.scheduled_at);
      const start = scheduled.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const end = new Date(scheduled.getTime() + 60*60*1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const summary = `Programare ${a.clients?.name || ''} - ${a.vehicles?.make || ''}`;
      const desc = a.notes || '';
      ics += `BEGIN:VEVENT\nUID:${a.id}@carcore.ro\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${escapeICS(summary)}\nDESCRIPTION:${escapeICS(desc)}\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
    });
    ics += 'END:VCALENDAR';

    const blob = new Blob([ics], { type: 'text/calendar' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const icsDate = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}` : 'toate';
    link.download = `programari_${icsDate}.ics`;
    link.click();
    toast.success(`Exportat ${dataToExport.length} evenimente ICS (UTC)`);
  };

  if (loading) return <div>Se încarcă...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Programări</h1>
        <div className="flex gap-2">
          <button 
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700"
          >
            Export CSV
          </button>
          <button 
            onClick={exportToICS}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700"
          >
            Export ICS (Calendar)
          </button>
          <button 
            onClick={() => setSelectedDate(null)}
            className="px-4 py-2 border text-sm rounded-xl hover:bg-gray-50"
          >
            Arată toate
          </button>
        </div>
      </div>

      <Calendar 
        appointments={appointments} 
        onSelectDate={(date) => {
          setSelectedDate(date);
          // Use local date parts (not toISOString) to avoid tz/DST day roll for datetime-local input
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          setCreateDate(`${y}-${m}-${d}T10:00`); // default 10am local
          setShowCreate(true);
        }} 
        selectedDate={selectedDate || undefined} 
      />

      {showCreate && (
        <div className="mt-4 bg-white rounded-2xl p-6 border">
          <h3 className="font-medium mb-3">Creează programare nouă</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await createAppointment(fd);
              toast.success('Programare creată');
              setShowCreate(false);
              await loadData();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Eroare la creare programare');
            }
          }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="hidden" name="scheduled_at" value={createDate} />
            <select name="client_id" required className="border rounded-xl px-4 py-2" onChange={(e) => setSelectedClientId(e.target.value)}>
              <option value="">Selectează client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select name="vehicle_id" required className="border rounded-xl px-4 py-2">
              <option value="">Selectează mașina</option>
              {vehicles.filter(v => !selectedClientId || v.client_id === selectedClientId).map(v => (
                <option key={v.id} value={v.id}>{v.make} {v.model} ({v.license_plate})</option>
              ))}
            </select>
            <input name="notes" placeholder="Notițe (opțional)" className="border rounded-xl px-4 py-2 md:col-span-2" />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="bg-black text-white px-6 py-2 rounded-xl">Creează programarea</button>
              <button type="button" onClick={() => setShowCreate(false)} className="border px-6 py-2 rounded-xl">Anulează</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 bg-white rounded-2xl p-6">
        <h2 className="text-lg font-medium mb-4">
          {selectedDate 
            ? `Programări pentru ${selectedDate.toLocaleDateString('ro-RO')}` 
            : 'Toate programările'}
          ({filteredAppointments.length})
        </h2>

        {filteredAppointments.length > 0 ? (
          <div className="space-y-4">
            {filteredAppointments.map((a: Appointment) => (
              <div key={a.id} className="border rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{a.clients?.name}</div>
                  <div className="text-sm text-zinc-600">
                    {a.vehicles?.make} {a.vehicles?.model} • {a.vehicles?.license_plate}
                  </div>
                  <div className="text-xs mt-1 text-zinc-500">
                    {new Date(a.scheduled_at).toLocaleString('ro-RO')}
                  </div>
                  {a.notes && <div className="text-xs mt-1 text-gray-500">{a.notes}</div>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 text-xs rounded-full bg-zinc-100">{a.status}</span>

                  {a.status === 'pending' && (
                    <button
                      onClick={async () => { await updateAppointmentStatus(a.id, 'confirmed'); await loadData(); }}
                      className="text-xs px-2 py-1 border rounded hover:bg-blue-50"
                    >
                      Confirmă
                    </button>
                  )}
                  {a.status === 'confirmed' && (
                    <button
                      onClick={async () => { await updateAppointmentStatus(a.id, 'completed'); await loadData(); }}
                      className="text-xs px-2 py-1 border rounded hover:bg-green-50"
                    >
                      Completează
                    </button>
                  )}

                  {a.clients?.email && (
                    <button onClick={() => sendAppointmentReminder(a.id)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-zinc-50">
                      Reminder
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            {selectedDate ? 'Nicio programare în această zi.' : 'Nicio programare înregistrată încă.'}
          </div>
        )}
      </div>
    </div>
  );
}
