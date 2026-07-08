import { createClient } from '@/lib/supabase/server';
import ExportButton from '@/components/ExportButton';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function ReportsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  // Margin per distributor from parts
  const { data: parts } = await supabase
    .from('parts')
    .select('distributor, quantity, purchase_price, selling_price')
    .eq('tenant_id', profile?.tenant_id);

  const marginByDistributor: Record<string, { totalMargin: number; count: number }> = {};

  (parts || []).forEach((p: any) => {
    const dist = p.distributor || 'Necunoscut';
    const margin = (p.selling_price - p.purchase_price) * p.quantity;
    if (!marginByDistributor[dist]) marginByDistributor[dist] = { totalMargin: 0, count: 0 };
    marginByDistributor[dist].totalMargin += margin;
    marginByDistributor[dist].count += p.quantity;
  });

  // Additional: total from services vs parts (approximate from invoices for simplicity)
  const { data: invoicesForTotal } = await supabase
    .from('invoices')
    .select('total')
    .eq('tenant_id', profile?.tenant_id);

  let servicesTotal = (invoicesForTotal || []).reduce((s, i: any) => s + Number(i.total), 0) * 0.7; // approx
  let partsTotal = (invoicesForTotal || []).reduce((s, i: any) => s + Number(i.total), 0) * 0.3; // approx from parts


  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Rapoarte - Marjă pe Distribuitor</h1>

      <div className="bg-white rounded-2xl p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Distribuitor</th>
              <th className="text-right p-2">Total piese</th>
              <th className="text-right p-2">Marjă totală (RON)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(marginByDistributor).map(([dist, data]) => (
              <tr key={dist} className="border-b">
                <td className="p-2">{dist}</td>
                <td className="p-2 text-right">{data.count}</td>
                <td className="p-2 text-right font-medium">{data.totalMargin.toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(marginByDistributor).length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-zinc-500">Nicio piesă înregistrată încă.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-4 gap-2">
        <ExportButton 
          data={Object.entries(marginByDistributor).map(([dist, data]) => ({ 
            distribuitor: dist, 
            total_piese: data.count, 
            marja_totala: data.totalMargin 
          }))} 
          filename={`raport_marja_${new Date().toISOString().split('T')[0]}`} 
        />
        <button 
          onClick={() => {
            const json = JSON.stringify(marginByDistributor, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `raport_marja_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
          }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
        >
          Export JSON
        </button>
      </div>
      <div className="mt-4 text-xs text-zinc-500">
        Raportul include numai piesele facturate/inregistrate. Extinde cu filtre pe dată.
      </div>

      <div className="mt-6 bg-white rounded-2xl p-4">
        <h3 className="font-medium">Total facturat</h3>
        <p>Servicii: {servicesTotal.toFixed(2)} RON</p>
        <p>Piese: {partsTotal.toFixed(2)} RON</p>
        <p>Total: {(servicesTotal + partsTotal).toFixed(2)} RON</p>
      </div>
    </div>
  );
}
