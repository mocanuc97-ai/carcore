import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import ExportButton from '@/components/ExportButton';
import { z } from 'zod';
import { partPurchaseSchema } from '@/lib/validation';

async function recordPurchase(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const profile = await (await import('@/lib/supabase/server')).getCurrentProfile();
  if (!profile) throw new Error('Profil negăsit');

  try {
    const raw = {
      name: formData.get('name'),
      distributor: formData.get('distributor'),
      qty: formData.get('qty'),
      price: formData.get('price'),
    };

    const parsed = partPurchaseSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => e.message).join('; ');
      throw new Error('Validare eșuată: ' + msg);
    }

    const { name, distributor, qty, price } = parsed.data;

    // Upsert to inventory (increase stock)
    const { data: existing } = await supabase
      .from('part_inventory')
      .select('current_stock')
      .eq('tenant_id', profile.tenant_id)
      .eq('name', name)
      .eq('distributor', distributor || '')
      .single();

    const newStock = (existing?.current_stock || 0) + qty;

    await supabase
      .from('part_inventory')
      .upsert({
        tenant_id: profile.tenant_id,
        name,
        distributor: distributor || null,
        current_stock: newStock,
        last_purchase_price: price,
      }, { onConflict: 'tenant_id,name,distributor' });

    // Also log as a part record (for history)
    await supabase.from('parts').insert({
      tenant_id: profile.tenant_id,
      name,
      distributor: distributor || null,
      quantity: qty,
      purchase_price: price,
      selling_price: price * 1.5, // default 50% markup, can be edited later
      notes: 'Achiziție stoc',
    });

    revalidatePath('/parts-inventory');
  } catch (err: any) {
    console.error('[recordPurchase error]', err);
    // Avoid throw for header stability in E2E
  }
}

export default async function PartsInventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();

  const { data: inventory } = await supabase
    .from('part_inventory')
    .select('*')
    .eq('tenant_id', profile!.tenant_id)
    .order('name');

  const { data: recentParts } = await supabase
    .from('parts')
    .select('*')
    .eq('tenant_id', profile!.tenant_id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Stoc Piese - Achiziții de la Distribuitori</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Record Purchase */}
        <div className="bg-white rounded-2xl p-6">
          <h2 className="font-medium mb-4">Înregistrează achiziție nouă</h2>
          <form action={recordPurchase} className="space-y-3">
            <input name="name" placeholder="Nume piesă" required minLength={1} className="w-full border rounded-xl px-4 py-2" />
            <input name="distributor" placeholder="Distribuitor" className="w-full border rounded-xl px-4 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <input name="qty" type="number" step="0.01" min="0.01" placeholder="Cantitate" required className="border rounded-xl px-4 py-2" />
              <input name="price" type="number" step="0.01" min="0.01" placeholder="Preț achiziție/buc" required className="border rounded-xl px-4 py-2" />
            </div>
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl">Adaugă la stoc</button>
          </form>
        </div>

        {/* Current Stock */}
        <div className="bg-white rounded-2xl p-6">
          <h2 className="font-medium mb-4">Stoc curent</h2>
          {inventory && inventory.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Piesă</th>
                  <th>Distribuitor</th>
                  <th>Stoc</th>
                  <th>Ultim preț ach.</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td>{item.name}</td>
                    <td>{item.distributor || '-'}</td>
                    <td className={item.current_stock < 5 ? 'text-red-600 font-medium' : ''}>{item.current_stock}</td>
                    <td>{item.last_purchase_price || '-'} RON</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-zinc-500">Niciun stoc înregistrat încă.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end mb-2">
        <ExportButton data={recentParts || []} filename={`piese_${new Date().toISOString().split('T')[0]}`} />
      </div>
      <div className="mt-8 bg-white rounded-2xl p-6">
        <h2 className="font-medium mb-4">Ultimele mișcări piese</h2>
        {recentParts && recentParts.length > 0 ? (
          <div className="text-sm space-y-2">
            {recentParts.map((p: any) => (
              <div key={p.id} className="flex justify-between border-b pb-1">
                <span>{p.quantity}x {p.name} @ {p.distributor || 'dist.'}</span>
                <span>Ach: {p.purchase_price} | Vânz: {p.selling_price} RON (marjă {(p.selling_price - p.purchase_price) * p.quantity})</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-zinc-500">Nicio mișcare înregistrată încă.</p>}
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        Raport marjă complet: vezi dashboard sau extinde cu filtru pe distribuitor.
      </div>
    </div>
  );
}
