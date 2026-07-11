'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { createAndSendInvoice } from '../actions';

export default function NewInvoicePage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [clientParts, setClientParts] = useState<any[]>([]);
  const [clientInterventions, setClientInterventions] = useState<any[]>([]);
  const [selectedInterventionId, setSelectedInterventionId] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [manualParts, setManualParts] = useState([{ name: '', qty: 1, price: 1, cost: 0 }]);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);

  const supabase = createClient();

  const selectedVehicle = vehicles.find((v: any) => v.id === selectedVehicleId);
  const selectedClientId = selectedVehicle?.client_id || '';
  const selectedClientName = selectedVehicle?.clients?.name || '';

  useEffect(() => {
    async function loadInitial() {
      const { data: { user } } = await supabase.auth.getUser();
      let tenantId: string | null = null;
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
        tenantId = prof?.tenant_id || null;
      }

      // Vehicle selection drives client identification — pick the car, the
      // client is looked up from vehicles.client_id automatically.
      let vhQuery = supabase.from('vehicles').select('id, make, model, license_plate, client_id, clients(id, name)').order('created_at', { ascending: false });
      if (tenantId) vhQuery = vhQuery.eq('tenant_id', tenantId);

      let svQuery = supabase.from('services').select('*').eq('is_active', true).order('name');
      if (tenantId) svQuery = svQuery.eq('tenant_id', tenantId);

      // Independent queries — run concurrently instead of one round-trip after another.
      const [{ data: vh }, { data: sv }, { data: invs }] = await Promise.all([
        vhQuery,
        svQuery,
        // Only the fields the stock guard on manual parts actually reads.
        tenantId ? supabase.from('part_inventory').select('name, current_stock').eq('tenant_id', tenantId) : Promise.resolve({ data: null }),
      ]);
      if (vh) setVehicles(vh);
      if (sv) setServices(sv);
      if (invs) setInventory(invs);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedVehicleId) {
      setClientParts([]);
      setClientInterventions([]);
      setSelectedInterventionId('');
      return;
    }

    async function loadVehicleData() {
      // Parts and interventions for this vehicle are independent queries — run concurrently.
      const [{ data: prts }, { data: ints }] = await Promise.all([
        supabase
          .from('parts')
          .select('*')
          .eq('vehicle_id', selectedVehicleId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('interventions')
          .select('id, description, performed_at, vehicles(make, model)')
          .eq('vehicle_id', selectedVehicleId)
          .order('performed_at', { ascending: false })
          .limit(5),
      ]);
      if (prts) setClientParts(prts);
      if (ints) setClientInterventions(ints);
    }
    loadVehicleData();
  }, [selectedVehicleId]);

  const addManualPart = () => {
    setManualParts([...manualParts, { name: '', qty: 1, price: 1, cost: 0 }]);
  };

  const updateManualPart = (index: number, field: string, value: any) => {
    const updated = [...manualParts];
    let v = value;
    if (field === 'qty' || field === 'price' || field === 'cost') {
      const num = parseFloat(value);
      if (field === 'qty') v = isNaN(num) || num < 0.01 ? 1 : num;
      else if (field === 'price') v = isNaN(num) || num < 0.01 ? 1 : num;
      else v = isNaN(num) || num < 0 ? 0 : num;
    }
    (updated[index] as any)[field] = v;
    setManualParts(updated);
  };

  // Extend state type
  // manualParts now support cost

  // Stock lookup for manual parts (match by name only, since manual entry in invoice
  // lacks distributor). The same name can have multiple part_inventory rows — one per
  // distributor — so sum across all of them rather than matching a single row. Built
  // once per inventory change instead of re-scanning the full list on every part/keystroke.
  const stockByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of inventory as any[]) {
      const key = i.name?.toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + (Number(i.current_stock) || 0));
    }
    return map;
  }, [inventory]);

  function getStockForPartName(name: string): number {
    if (!name) return Infinity;
    const total = stockByName.get(name.toLowerCase());
    return total === undefined ? Infinity : total;
  }

  function hasInsufficientManualStock(): boolean {
    return manualParts.some(p => {
      if (!p.name || p.name.trim() === '' || p.qty <= 0) return false;
      const avail = getStockForPartName(p.name);
      return avail !== Infinity && avail < p.qty;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Client-side validation to prevent bypass of weak HTML (negatives, empty, no items)
    if (!selectedVehicleId || !selectedClientId) {
      toast.error('Selectează o mașină (clientul se identifică automat)');
      setLoading(false);
      return;
    }

    const hasServices = selectedServices.length > 0;

    // Collect valid manual parts (qty>0, price>0)
    const validManual = manualParts.filter(p => p.name.trim() && p.qty > 0 && p.price > 0);

    // Collect checked client parts (trust DB values for qty/price here)
    const checkedClientParts: any[] = [];
    clientParts.forEach((p: any) => {
      const chk = document.getElementById(`part-${p.id}`) as HTMLInputElement;
      if (chk?.checked && p.quantity > 0 && p.selling_price > 0) {
        checkedClientParts.push(p);
      }
    });

    const hasParts = validManual.length > 0 || checkedClientParts.length > 0 || (selectedInterventionId && true); // intervention may bring parts

    if (!hasServices && !hasParts) {
      toast.error('Trebuie să selectezi cel puțin un serviciu sau o piesă cu preț/cantitate pozitivă');
      setLoading(false);
      return;
    }

    // UI + pre-submit guard: only manual parts (not hist/intervention) are subject to stock deduct at invoice time
    for (const p of validManual) {
      const avail = getStockForPartName(p.name);
      if (avail !== Infinity && avail < p.qty) {
        toast.error(`Stoc insuficient pentru piesa manuală "${p.name}" (disponibil: ${avail}, cerut: ${p.qty})`);
        setLoading(false);
        return;
      }
    }

    const formData = new FormData();
    formData.append('client_id', selectedClientId);
    formData.append('vehicle_id', selectedVehicleId);
    if (selectedInterventionId) formData.append('intervention_id', selectedInterventionId);

    selectedServices.forEach(id => formData.append('service_ids', id));

    validManual.forEach(p => {
      formData.append('part_name', p.name.trim());
      formData.append('part_qty', p.qty.toString());
      formData.append('part_cost', (p.cost || 0).toString());
      formData.append('part_price', p.price.toString());
    });

    // Historical/client parts from past interventions use 'hist_' keys (server includes in invoice_items but skips stock deduction to prevent double deduct)
    checkedClientParts.forEach((p: any) => {
      formData.append('hist_part_name', p.name);
      formData.append('hist_part_qty', p.quantity.toString());
      formData.append('hist_part_cost', (p.purchase_price || 0).toString());
      formData.append('hist_part_price', p.selling_price.toString());
    });

    try {
      await createAndSendInvoice(formData);
      window.location.href = '/invoices';
    } catch (err: any) {
      toast.error(err.message || 'Eroare la creare factură');
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Creează factură nouă</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl max-w-2xl space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Mașină</label>
          <select
            data-testid="invoice-vehicle-select"
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            required
            className="w-full border rounded-xl px-4 py-2.5"
          >
            <option value="">Selectează mașina</option>
            {vehicles.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} {v.license_plate ? `- ${v.license_plate}` : ''} ({v.clients?.name})
              </option>
            ))}
          </select>
          {selectedVehicleId && (
            <p className="text-xs text-zinc-500 mt-1.5" data-testid="invoice-auto-client">
              Client identificat automat: <span className="font-medium text-zinc-700">{selectedClientName}</span>
            </p>
          )}
          {vehicles.length === 0 && (
            <p className="text-xs text-red-600 mt-1.5">
              Niciun vehicul înregistrat încă. Adaugă mai întâi o mașină din pagina unui client.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Servicii</label>
          <div className="border rounded-xl p-4 max-h-48 overflow-auto space-y-2 bg-zinc-50">
            {services.map((s: any) => (
              <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(s.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedServices([...selectedServices, s.id]);
                    } else {
                      setSelectedServices(selectedServices.filter(id => id !== s.id));
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="flex-1">{s.name}</span>
                <span className="font-medium">{s.price} RON</span>
              </label>
            ))}
          </div>
        </div>

        {/* Select intervention to auto-include its parts */}
        {clientInterventions.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Alege intervenție (piese se adaugă automat)</label>
            <select
              value={selectedInterventionId}
              onChange={(e) => setSelectedInterventionId(e.target.value)}
              className="w-full border rounded-xl px-4 py-2 text-sm mb-2"
            >
              <option value="">Fără intervenție specifică</option>
              {clientInterventions.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {new Date(i.performed_at).toLocaleDateString('ro-RO')} - {i.vehicles?.make} {i.vehicles?.model} ({i.description?.substring(0,30)}...)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Parts from this client's interventions */}
        {clientParts.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Piese din intervențiile mașinii (selectează)</label>
            <div className="border rounded-xl p-4 space-y-2 bg-zinc-50">
              {clientParts
                .filter((p: any) => !selectedInterventionId || p.intervention_id === selectedInterventionId)
                .map((p: any) => (
                <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" id={`part-${p.id}`} className="w-4 h-4" defaultChecked />
                  <span className="flex-1">{p.quantity}x {p.name} ({p.distributor || 'dist.'})</span>
                  <span className="font-medium">{p.selling_price} RON/buc</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Manual parts from distributors */}
        <div>
          <label className="block text-sm font-medium mb-2 flex justify-between">
            <span>Piese achiziționate de la distribuitori (adaugă manual)</span>
            <button type="button" onClick={addManualPart} className="text-xs text-blue-600">+ Adaugă rând</button>
          </label>
          <div className="space-y-2">
            {manualParts.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  name="part_name"
                  placeholder="Nume piesă"
                  value={p.name}
                  onChange={(e) => updateManualPart(i, 'name', e.target.value)}
                  className="col-span-4 border rounded-xl px-3 py-2 text-sm"
                />
                <input
                  name="part_qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={p.qty}
                  onChange={(e) => updateManualPart(i, 'qty', e.target.value)}
                  className="col-span-2 border rounded-xl px-3 py-2 text-sm"
                  required
                />
                <input
                  name="part_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Cost ach."
                  value={p.cost || 0}
                  onChange={(e) => updateManualPart(i, 'cost', e.target.value)}
                  className="col-span-3 border rounded-xl px-3 py-2 text-sm"
                />
                <input
                  name="part_price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Preț vânz."
                  value={p.price}
                  onChange={(e) => updateManualPart(i, 'price', e.target.value)}
                  className="col-span-3 border rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
            ))}
          </div>
          {manualParts.some(p => p.name.trim()) && (
            <div className="text-xs text-zinc-500">
              Stoc verificat pentru piese manuale (doar acestea deduc stoc la facturare).
              {hasInsufficientManualStock() && <span className="text-red-600 ml-1 font-medium">⚠️ O parte manuală depășește stocul - buton dezactivat.</span>}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={Boolean(loading || !selectedVehicleId || hasInsufficientManualStock())}
          className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-zinc-900 disabled:opacity-50"
        >
          {loading ? 'Se creează...' : (hasInsufficientManualStock() ? 'Stoc insuficient pentru piese manuale' : 'Creează factură + Trimite pe email (cu PDF)')}
        </button>

        <p className="text-xs text-center text-zinc-500">
          Servicii + piese vor fi incluse. Piesele cumpărate de la distribuitori apar pe factură.
        </p>
      </form>
    </div>
  );
}
