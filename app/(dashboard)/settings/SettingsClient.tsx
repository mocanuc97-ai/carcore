'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function SettingsClient({ tenant: initialTenant, anafConnection: initialConnection, role = 'admin' }: { tenant: any; anafConnection?: any; role?: 'admin' | 'reception' }) {
  const [tenant, setTenant] = useState(initialTenant || {});
  const [connection, setConnection] = useState(initialConnection);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const isAdmin = role === 'admin';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'anaf_connected') {
      toast.success('Conectat cu succes la ANAF (simulare)!');
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    }
    if (params.get('error')) {
      toast.error('Eroare la conectare ANAF');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleUpdate = async (formData: FormData) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();

    const updates = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      default_parts_markup_percent: Number(formData.get('default_parts_markup_percent')) || 0,
      labor_rate_per_hour: Number(formData.get('labor_rate_per_hour')) || 0,
    };

    const { error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', profile!.tenant_id);

    if (error) {
      toast.error('Eroare la salvare: ' + error.message);
    } else {
      toast.success('Setări salvate');
      setTenant({ ...tenant, ...updates });
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();

    const path = `${profile!.tenant_id}/logo-${Date.now()}.${file.name.split('.').pop()}`;

    const { error: uploadError } = await supabase.storage
      .from('intervention-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Eroare upload logo: ' + uploadError.message);
      setLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('intervention-photos').getPublicUrl(path);

    const { error } = await supabase
      .from('tenants')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', profile!.tenant_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Logo actualizat');
      setTenant({ ...tenant, logo_url: urlData.publicUrl });
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Setări Service</h1>

      <div className="bg-white rounded-2xl p-6 max-w-xl space-y-6">
        <form action={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Nume Service</label>
            <input name="name" defaultValue={tenant.name} className="w-full border rounded-xl px-4 py-2" required />
          </div>
          <div>
            <label className="block text-sm mb-1">Telefon</label>
            <input name="phone" defaultValue={tenant.phone} className="w-full border rounded-xl px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="email" defaultValue={tenant.email} className="w-full border rounded-xl px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Adresă</label>
            <input name="address" defaultValue={tenant.address} className="w-full border rounded-xl px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Adaos implicit piese (%)</label>
            <input
              name="default_parts_markup_percent"
              type="number"
              min={0}
              step="0.1"
              defaultValue={tenant.default_parts_markup_percent ?? 20}
              className="w-full border rounded-xl px-4 py-2"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Folosit ca valoare implicită la înregistrarea în stoc a pieselor din facturile primite de la furnizori.
            </p>
          </div>
          <div>
            <label className="block text-sm mb-1">Tarif manoperă (RON/oră)</label>
            <input
              name="labor_rate_per_hour"
              type="number"
              min={0}
              step="0.01"
              defaultValue={tenant.labor_rate_per_hour ?? 150}
              className="w-full border rounded-xl px-4 py-2"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Punctul de manoperă prestabilit — precompletează linia de manoperă la crearea unei facturi.
            </p>
          </div>

          <button type="submit" disabled={loading} className="bg-black text-white px-6 py-2 rounded-xl disabled:opacity-50">
            {loading ? 'Se salvează...' : 'Salvează datele'}
          </button>
        </form>

        <div>
          <label className="block text-sm mb-2">Logo (apare pe facturi)</label>
          {tenant.logo_url && (
            <img src={tenant.logo_url} alt="Logo" className="h-12 mb-3 object-contain border rounded" />
          )}
          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={loading} />
          <p className="text-xs text-zinc-500 mt-1">Logo-ul va fi folosit în PDF-urile de factură.</p>
        </div>

        {/* ANAF e-Factura Connection - admin only */}
        {isAdmin ? (
        <div className="pt-6 border-t">
          <h3 className="font-semibold mb-2">Conectare ANAF e-Factura (SPV)</h3>
          <p className="text-xs text-zinc-500 mb-3">
            Pentru a trimite facturi direct la ANAF trebuie să conectezi contul SPV al service-ului.
          </p>

          <div className={`rounded-xl p-4 text-sm ${connection?.status === 'connected' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className="font-medium mb-2">
              Status: {' '}
              <span className={
                connection?.status === 'connected' && (!connection.token_expires_at || new Date(connection.token_expires_at) > new Date())
                  ? 'text-green-700' 
                  : connection?.status === 'expired' ? 'text-orange-700' : 'text-yellow-700'
              }>
                {connection?.status === 'connected' && (!connection.token_expires_at || new Date(connection.token_expires_at) > new Date())
                  ? 'Conectat' 
                  : connection?.status === 'expired' ? 'Expirat' : (connection?.status || 'Deconectat')}
              </span>
            </p>

            {connection?.status === 'connected' && (
              <div className="mb-3 text-xs">
                CUI: <strong>{connection.cui}</strong><br />
                Token expiră: {connection.token_expires_at ? new Date(connection.token_expires_at).toLocaleString('ro-RO') : 'N/A'}
              </div>
            )}
            
            <div className="space-y-3 mt-3">
              <input 
                type="text" 
                placeholder="CUI (ex: RO12345678)" 
                className="w-full border rounded px-3 py-2 text-sm" 
                id="cui-input"
                defaultValue={tenant.cui || connection?.cui || 'RO12345678'} 
              />
              <button
                onClick={() => {
                  const cui = (document.getElementById('cui-input') as HTMLInputElement)?.value || 'RO00000000';
                  window.location.href = `/api/anaf/connect?cui=${encodeURIComponent(cui)}`;
                }}
                className="w-full bg-blue-600 text-white text-sm py-2 rounded-xl hover:bg-blue-700"
              >
                {connection?.status === 'connected' ? 'Reconectează' : 'Conectează cu cont ANAF SPV'}
              </button>

              {/* Browser test sim: connect with expiry */}
              <button
                onClick={() => {
                  const cui = (document.getElementById('cui-input') as HTMLInputElement)?.value || 'RO00000000';
                  window.location.href = `/api/anaf/connect?cui=${encodeURIComponent(cui)}&test_expiry=expired`;
                }}
                className="w-full bg-amber-600 text-white text-sm py-1.5 rounded-xl hover:bg-amber-700"
              >
                Conectează cu token EXPIRAT (test)
              </button>

              {connection?.status === 'connected' && (
                <button
                  onClick={async () => {
                    if (!confirm('Deconectezi contul ANAF?')) return;
                    const { data: { user } } = await supabase.auth.getUser();
                    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();
                    await supabase.from('tenant_anaf_connections').update({ status: 'disconnected', access_token: null }).eq('tenant_id', profile!.tenant_id);
                    toast.success('Deconectat');
                    window.location.reload();
                  }}
                  className="w-full text-red-600 text-sm py-1.5 border border-red-200 rounded-xl hover:bg-red-50"
                >
                  Deconectează
                </button>
              )}

              <p className="text-[10px] text-zinc-500">
                Simulează fluxul OAuth ANAF. În producție va face redirect real la ANAF SPV pentru autorizare.
              </p>

              {connection?.status === 'connected' && (
                <button
                  onClick={async () => {
                    // Simulate real token refresh
                    const { data: { user } } = await supabase.auth.getUser();
                    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();
                    await supabase.from('tenant_anaf_connections').update({ 
                      access_token: 'REAL_ANAF_TOKEN_' + Date.now(),
                      token_expires_at: new Date(Date.now() + 3600 * 1000 * 2).toISOString()
                    }).eq('tenant_id', profile!.tenant_id);
                    toast.success('Token reîmprospătat (simulare reală)');
                    window.location.reload();
                  }}
                  className="w-full text-xs py-1 border rounded hover:bg-gray-50"
                >
                  Reîmprospătează token (simulare real ANAF)
                </button>
              )}

              {/* Browser test sim: force expiry on current connection */}
              <button
                onClick={async () => {
                  if (!confirm('Set token to expired for testing checks?')) return;
                  const { data: { user } } = await supabase.auth.getUser();
                  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();
                  await supabase.from('tenant_anaf_connections').update({ 
                    token_expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
                    status: 'expired'
                  }).eq('tenant_id', profile!.tenant_id);
                  toast.success('Token setat ca expirat (pentru test checks)');
                  window.location.reload();
                }}
                className="w-full text-xs py-1 border border-orange-300 text-orange-700 rounded hover:bg-orange-50"
              >
                Simulează token expirat (test send/poll checks)
              </button>
            </div>
          </div>
        </div>
        ) : (
          <div className="pt-6 border-t text-xs text-zinc-500">Secțiunea ANAF e-Factura este disponibilă doar pentru administratori (rol recepție curent).</div>
        )}
      </div>
    </div>
  );
}
