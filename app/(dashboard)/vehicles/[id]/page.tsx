import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ExportButton from '@/components/ExportButton';
import IncompleteBadge from '@/components/IncompleteBadge';
import { getVehicleMissingFields } from '@/lib/profile-completeness';
import { getCurrentProfile } from '@/lib/supabase/server';
import { updateVehicle } from './actions';

export default async function VehicleHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const tenantId = profile?.tenant_id;

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*, clients(name)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (!vehicle) {
    return <div>Mașina nu a fost găsită sau acces refuzat.</div>;
  }

  // Explicit tenant check for safety (in case RLS edge)
  if (vehicle.tenant_id !== tenantId) {
    return <div>Acces interzis la date multi-tenant.</div>;
  }

  const { data: interventions } = await supabase
    .from('interventions')
    .select('*')
    .eq('vehicle_id', id)
    .eq('tenant_id', tenantId)
    .order('performed_at', { ascending: false });

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('client_id', vehicle.client_id)
    .eq('tenant_id', tenantId)
    .order('issued_at', { ascending: false });

  const { data: parts } = await supabase
    .from('parts')
    .select('*')
    .eq('vehicle_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (
    <div>
      <Link href="/vehicles" className="text-sm text-blue-600">← Înapoi la mașini</Link>

      <div className="flex items-center gap-3 mt-4">
        <h1 className="text-2xl font-semibold">
          {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
        </h1>
        <IncompleteBadge missing={getVehicleMissingFields(vehicle)} />
      </div>
      <p className="text-zinc-600">Client: {vehicle.clients?.name} • VIN: {vehicle.vin || '—'} • Nr: {vehicle.license_plate || '—'}</p>

      <div className="bg-white rounded-2xl p-6 mt-4 max-w-2xl">
        <h3 className="font-medium mb-4">Editează datele mașinii</h3>
        <form action={updateVehicle.bind(null, vehicle.id)} className="grid grid-cols-2 gap-3">
          <input name="make" defaultValue={vehicle.make} placeholder="Marcă" required className="border rounded-xl px-4 py-2" />
          <input name="model" defaultValue={vehicle.model} placeholder="Model" required className="border rounded-xl px-4 py-2" />
          <input name="vin" defaultValue={vehicle.vin || ''} placeholder="Serie caroserie (VIN)" className="border rounded-xl px-4 py-2" />
          <input name="license_plate" defaultValue={vehicle.license_plate || ''} placeholder="Număr înmatriculare" className="border rounded-xl px-4 py-2" />
          <input name="year" type="number" defaultValue={vehicle.year || ''} placeholder="An" className="border rounded-xl px-4 py-2" />
          <input name="mileage" type="number" defaultValue={vehicle.mileage || ''} placeholder="Km" className="border rounded-xl px-4 py-2" />
          <input name="color" defaultValue={vehicle.color || ''} placeholder="Culoare" className="border rounded-xl px-4 py-2 col-span-2" />
          <button type="submit" className="bg-black text-white rounded-xl px-4 py-2 col-span-2">Salvează</button>
        </form>
      </div>

      <div className="mt-2">
        <ExportButton
          data={[
            ...(interventions || []).map((i: any) => ({ type: 'interventie', data: new Date(i.performed_at).toISOString(), descriere: i.description, poze: i.photos?.length || 0 })),
            ...(parts || []).map((p: any) => ({ type: 'piesa', nume: p.name, cantitate: p.quantity, pret_vanzare: p.selling_price, marja: (p.selling_price - p.purchase_price) * p.quantity }))
          ]} 
          filename={`istoric_vehicul_${vehicle.vin || id}_${new Date().toISOString().split('T')[0]}`} 
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Interventions */}
        <div>
          <h2 className="font-semibold mb-3">Istoric intervenții + Piese</h2>
          <div className="bg-white rounded-2xl p-4 space-y-4">
            {interventions && interventions.length > 0 ? interventions.map((int: any) => (
              <div key={int.id} className="border-b pb-3 last:border-0">
                <div className="text-sm font-medium">{new Date(int.performed_at).toLocaleDateString('ro-RO')}</div>
                <p className="text-sm mt-1">{int.description}</p>
                {int.photos && int.photos.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {int.photos.slice(0,3).map((path: string, idx: number) => {
                      // Note: in real, use supabase storage public url
                      return <span key={idx} className="text-[10px] bg-blue-100 px-1 rounded">📷</span>;
                    })}
                    <span className="text-xs text-blue-600">{int.photos.length} poze</span>
                  </div>
                )}
                {int.total_price && <div className="text-xs mt-1">Total: {int.total_price} RON</div>}
              </div>
            )) : <p className="text-sm text-zinc-500">Nicio intervenție înregistrată încă.</p>}

            {/* Parts for this vehicle */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Piese pentru acest vehicul</h4>
              {parts && parts.length > 0 ? parts.map((p: any) => (
                <div key={p.id} className="text-xs flex justify-between border-t py-1">
                  <span>{p.quantity}x {p.name} ({p.distributor || '-'})</span>
                  <span>Vânz: {p.selling_price} | Ach: {p.purchase_price} | Marjă: {(p.selling_price - p.purchase_price) * p.quantity}</span>
                </div>
              )) : <p className="text-xs text-zinc-500">Nicio piesă înregistrată încă.</p>}
            </div>
          </div>
        </div>

        {/* Related invoices */}
        <div>
          <h2 className="font-semibold mb-3">Facturi asociate</h2>
          <div className="bg-white rounded-2xl p-4 space-y-3">
            {invoices && invoices.length > 0 ? invoices.slice(0, 5).map((inv: any) => (
              <div key={inv.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                <div>{inv.number}</div>
                <div>{inv.total} RON</div>
              </div>
            )) : <p className="text-sm text-zinc-500">Nicio factură înregistrată încă.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
