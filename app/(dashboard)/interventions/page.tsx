'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { addPartToIntervention } from './add-part-action';
import { addInterventionCatalogEntry, deleteInterventionCatalogEntry } from './catalog-actions';

export default function InterventionsPage() {
  const [description, setDescription] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [newCatalogName, setNewCatalogName] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  const supabase = createClient();

  // Helper: lookup current stock for name+distributor. Infinity means not tracked in inventory (allow, no deduct)
  function getAvailableStock(name: string, distributor: string = ''): number {
    if (!name) return Infinity;
    const match = inventory.find((i: any) =>
      i.name?.toLowerCase() === name.toLowerCase() && (i.distributor || '') === (distributor || '')
    );
    return match ? Number(match.current_stock) || 0 : Infinity;
  }

  // Controlled state for add-part form (to support real-time UI stock guard)
  const [partForm, setPartForm] = useState({
    intervention_id: '',
    name: '',
    distributor: '',
    qty: 1,
    purchase_price: 0,
    selling_price: 1,
  });

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    let tenantId: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      tenantId = prof?.tenant_id || null;
    }

    let vehQuery = supabase.from('vehicles').select('id, make, model, clients(name)');
    if (tenantId) vehQuery = vehQuery.eq('tenant_id', tenantId);
    const { data: veh } = await vehQuery;
    if (veh) setVehicles(veh);

    let intQuery = supabase
      .from('interventions')
      .select('*, vehicles(make, model, clients(name))')
      .order('performed_at', { ascending: false })
      .limit(20);
    if (tenantId) intQuery = intQuery.eq('tenant_id', tenantId);
    const { data: ints } = await intQuery;
    if (ints) setInterventions(ints);

    // Load parts too
    let prtQuery = supabase
      .from('parts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (tenantId) prtQuery = prtQuery.eq('tenant_id', tenantId);
    const { data: prts } = await prtQuery;
    if (prts) setParts(prts);

    // Load inventory for stock guards (pre-checks in UI)
    if (tenantId) {
      const { data: invData } = await supabase
        .from('part_inventory')
        .select('*')
        .eq('tenant_id', tenantId);
      if (invData) setInventory(invData);
    }

    // Editable catalog of common intervention types — most-used first (sort_order, then name)
    if (tenantId) {
      const { data: catData } = await supabase
        .from('intervention_catalog')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (catData) setCatalog(catData);
    }
  }

  const handleAddCatalogEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatalogName.trim()) return;
    setCatalogLoading(true);
    const formData = new FormData();
    formData.append('name', newCatalogName.trim());
    const result = await addInterventionCatalogEntry(formData);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setNewCatalogName('');
      await loadData();
    }
    setCatalogLoading(false);
  };

  const handleDeleteCatalogEntry = async (id: string, name: string) => {
    if (!confirm(`Ștergi tipul de intervenție "${name}" din listă?`)) return;
    const result = await deleteInterventionCatalogEntry(id);
    if (result?.error) {
      toast.error(result.error);
    } else {
      await loadData();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !description) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();

    const photoPaths: string[] = [];
    const uploadErrors: string[] = [];

    // Enforce max 6 also here (defensive) + surface all upload errors, no silent drop
    const filesToUpload = files.slice(0, 6);
    for (const file of filesToUpload) {
      const path = `${profile!.tenant_id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('intervention-photos')
        .upload(path, file);

      if (error) {
        uploadErrors.push(`${file.name}: ${error.message}`);
        toast.error(`Eroare upload poză "${file.name}": ${error.message}`);
      } else {
        photoPaths.push(path);
      }
    }
    if (uploadErrors.length > 0 && photoPaths.length === 0) {
      toast.error('Nicio poză nu a putut fi încărcată. Intervenția va fi salvată fără poze.');
    } else if (uploadErrors.length > 0) {
      toast.warning(`Unele poze au eșuat (${uploadErrors.length}). Salvate ${photoPaths.length}.`);
    }

    const { error } = await supabase.from('interventions').insert({
      tenant_id: profile!.tenant_id,
      vehicle_id: vehicleId,
      description,
      photos: photoPaths,
    });

    if (error) {
      toast.error('Eroare: ' + error.message);
    } else {
      const msg = photoPaths.length > 0
        ? `Intervenție salvată cu ${photoPaths.length} poze`
        : uploadErrors.length > 0
          ? 'Intervenție salvată (fără poze din cauza erorilor upload)'
          : 'Intervenție salvată';
      toast.success(msg);
      setDescription('');
      setFiles([]);
      await loadData();
    }
    setLoading(false);
  };

  // handleAddPart: client wrapper for stock guard + server action call
  const handleAddPart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const available = getAvailableStock(partForm.name, partForm.distributor);
    const insufficient = partForm.name && available !== Infinity && available < partForm.qty;
    if (insufficient) {
      toast.error(`Stoc insuficient pentru "${partForm.name}". Disponibil: ${available} (cerut: ${partForm.qty})`);
      return;
    }
    if (!partForm.intervention_id || !partForm.name || !(partForm.selling_price > 0) || !(partForm.qty > 0)) {
      toast.error('Cantitate și preț vânzare trebuie >0');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('intervention_id', partForm.intervention_id);
    formData.append('name', partForm.name);
    formData.append('distributor', partForm.distributor);
    formData.append('qty', String(partForm.qty));
    formData.append('purchase_price', String(partForm.purchase_price));
    formData.append('selling_price', String(partForm.selling_price));

    try {
      const result = await addPartToIntervention(formData);
      toast.success(
        result?.trackedStock
          ? 'Piesă adăugată (stoc actualizat)'
          : 'Piesă adăugată (fără evidență în stoc — adaug-o din "Stoc Piese" ca să urmărești cantitatea)'
      );
      setPartForm({ intervention_id: '', name: '', distributor: '', qty: 1, purchase_price: 0, selling_price: 1 });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Eroare la adăugare piesă');
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Intervenții + Poze</h1>

      {/* Add form */}
      <div className="bg-white p-6 rounded-2xl mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required className="w-full border rounded-xl px-4 py-2">
              <option value="">Alege mașina</option>
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>{v.clients?.name} — {v.make} {v.model}</option>
              ))}
            </select>

            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descriere intervenție..." required className="w-full border rounded-xl p-4 h-24" />

            <div>
              <label className="block text-sm mb-1">Poze (max 6)</label>
              <input type="file" multiple accept="image/*" onChange={(e) => {
                const selectedAll = Array.from(e.target.files || []);
                if (selectedAll.length > 6) {
                  toast.error('Maxim 6 poze permise. Se vor folosi primele 6.');
                }
                const selected = selectedAll.slice(0, 6);
                setFiles(selected);
              }} />
              <p className="text-xs text-zinc-500 mt-1">{files.length} fișiere selectate (max 6)</p>
              {files.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {files.map((f, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={`preview ${i}`}
                        className="w-16 h-16 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center opacity-80 hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={Boolean(loading || !vehicleId || !description)} className="bg-black text-white px-6 py-2 rounded-xl disabled:opacity-50">
              {loading ? 'Se salvează...' : 'Salvează intervenție + poze'}
            </button>
          </form>

          {/* Editable catalog of common intervention types — most-used first, click to prefill the description above */}
          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-6">
            <h3 className="text-sm font-medium mb-1">Intervenții uzuale</h3>
            <p className="text-xs text-zinc-500 mb-3">Clic pentru a completa descrierea (rămâne editabilă).</p>
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4" data-testid="intervention-catalog-list">
              {catalog.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-1 group">
                  <button
                    type="button"
                    onClick={() => setDescription(c.name)}
                    className="flex-1 text-left text-sm px-2 py-1.5 rounded-lg hover:bg-zinc-100 truncate"
                    data-testid={`catalog-pick-${c.id}`}
                  >
                    {c.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCatalogEntry(c.id, c.name)}
                    className="text-zinc-300 hover:text-red-600 text-xs px-1.5"
                    title="Șterge din listă"
                    data-testid={`catalog-delete-${c.id}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {catalog.length === 0 && <p className="text-xs text-zinc-400">Nicio intervenție în listă.</p>}
            </div>
            <form onSubmit={handleAddCatalogEntry} className="flex gap-2">
              <input
                value={newCatalogName}
                onChange={(e) => setNewCatalogName(e.target.value)}
                placeholder="Tip nou..."
                className="flex-1 border rounded-lg px-2 py-1.5 text-sm min-w-0"
                data-testid="catalog-new-input"
              />
              <button
                type="submit"
                disabled={Boolean(catalogLoading || !newCatalogName.trim())}
                className="text-sm bg-zinc-900 text-white px-3 rounded-lg disabled:opacity-50"
                data-testid="catalog-add-button"
              >
                +
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Add Purchased Parts from Distributors - with UI stock guard */}
      <div className="bg-white p-6 rounded-2xl mb-8">
        <h3 className="font-medium mb-4">Adaugă piesă achiziționată de la distribuitor (pentru facturare)</h3>
        <form onSubmit={handleAddPart} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select 
            name="intervention_id" 
            value={partForm.intervention_id}
            onChange={(e) => setPartForm({ ...partForm, intervention_id: e.target.value })}
            required 
            className="border rounded-xl px-4 py-2"
          >
            <option value="">Alege intervenția</option>
            {interventions.map(i => (
              <option key={i.id} value={i.id}>
                {i.vehicles?.clients?.name} - {i.description?.substring(0, 40)}...
              </option>
            ))}
          </select>

          <input 
            name="name" 
            placeholder="Nume piesă" 
            value={partForm.name}
            onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
            required 
            className="border rounded-xl px-4 py-2" 
          />
          <input 
            name="distributor" 
            placeholder="Distribuitor" 
            value={partForm.distributor}
            onChange={(e) => setPartForm({ ...partForm, distributor: e.target.value })}
            className="border rounded-xl px-4 py-2" 
          />

          <input 
            name="qty" 
            type="number" 
            step="0.01" 
            min="0.01" 
            value={partForm.qty}
            onChange={(e) => setPartForm({ ...partForm, qty: parseFloat(e.target.value) || 1 })}
            placeholder="Cantitate" 
            required 
            className="border rounded-xl px-4 py-2" 
          />
          <input 
            name="purchase_price" 
            type="number" 
            step="0.01" 
            min="0" 
            value={partForm.purchase_price}
            onChange={(e) => setPartForm({ ...partForm, purchase_price: parseFloat(e.target.value) || 0 })}
            placeholder="Preț achiziție" 
            className="border rounded-xl px-4 py-2" 
          />
          <input 
            name="selling_price" 
            type="number" 
            step="0.01" 
            min="0.01" 
            value={partForm.selling_price}
            onChange={(e) => setPartForm({ ...partForm, selling_price: parseFloat(e.target.value) || 0 })}
            placeholder="Preț vânzare client" 
            required 
            className="border rounded-xl px-4 py-2" 
          />

          {partForm.name && getAvailableStock(partForm.name, partForm.distributor) !== Infinity && (
            <div className="md:col-span-3 text-xs">
              Stoc disponibil: <span className={getAvailableStock(partForm.name, partForm.distributor) < partForm.qty ? 'text-red-600 font-semibold' : 'text-green-600'}>{getAvailableStock(partForm.name, partForm.distributor)}</span>
            </div>
          )}
          {partForm.name && getAvailableStock(partForm.name, partForm.distributor) !== Infinity && getAvailableStock(partForm.name, partForm.distributor) < partForm.qty && (
            <div className="md:col-span-3 text-xs text-red-600">⚠️ Stoc insuficient - butonul dezactivat</div>
          )}

          <button 
            type="submit" 
            disabled={Boolean(loading || !partForm.intervention_id || !partForm.name || !partForm.selling_price || (partForm.name && getAvailableStock(partForm.name, partForm.distributor) !== Infinity && getAvailableStock(partForm.name, partForm.distributor) < partForm.qty))} 
            className="bg-black text-white px-6 py-2 rounded-xl md:col-span-3 disabled:opacity-50"
          >
            {loading ? 'Se salvează...' : 'Adaugă piesă la intervenție'}
          </button>
        </form>
        <p className="text-xs text-zinc-500 mt-2">Pre-verificare stoc activă: nu se permite deducere dacă current_stock &lt; qty.</p>
      </div>

      {/* List of interventions with photos */}
      <h2 className="text-xl font-medium mb-4">Istoric intervenții</h2>
      <div className="space-y-6">
        {interventions.length > 0 ? (
          interventions.map((int: any) => (
            <div key={int.id} className="bg-white rounded-2xl p-5">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{int.vehicles?.clients?.name} — {int.vehicles?.make} {int.vehicles?.model}</div>
                  <div className="text-sm text-zinc-500">{new Date(int.performed_at).toLocaleDateString('ro-RO')}</div>
                </div>
                {int.total_price && <div className="font-semibold">{int.total_price} RON</div>}
              </div>

              <p className="mt-3 text-sm">{int.description}</p>

              {/* Associated parts from distributors */}
              {parts.filter(p => p.intervention_id === int.id).length > 0 && (
                <div className="mt-3 text-sm">
                  <div className="font-medium text-xs text-zinc-500 mb-1">Piese achiziționate:</div>
                  {parts.filter(p => p.intervention_id === int.id).map((p: any) => (
                    <div key={p.id} className="flex justify-between text-xs border-t pt-1">
                      <span>{p.quantity}x {p.name} ({p.distributor || 'distribuitor necunoscut'})</span>
                      <span className="font-medium">{p.selling_price * p.quantity} RON</span>
                    </div>
                  ))}
                </div>
              )}

              {int.photos && int.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {int.photos.map((path: string, idx: number) => {
                    const { data } = supabase.storage.from('intervention-photos').getPublicUrl(path);
                    return (
                      <a key={idx} href={data.publicUrl} target="_blank" className="block">
                        <img src={data.publicUrl} alt={`Poza ${idx + 1}`} className="rounded-xl object-cover w-full h-32 border" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-zinc-500">Nicio intervenție înregistrată încă.</div>
        )}
      </div>
    </div>
  );
}
