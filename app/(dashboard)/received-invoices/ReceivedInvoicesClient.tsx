'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { pollReceivedEfactura, processReceivedInvoice } from './actions';

interface ReceivedInvoicesClientProps {
  invoices: any[];
  defaultMarkupPercent: number;
  role: 'admin' | 'reception';
}

export default function ReceivedInvoicesClient({ invoices, defaultMarkupPercent, role }: ReceivedInvoicesClientProps) {
  const router = useRouter();
  const [polling, setPolling] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [markups, setMarkups] = useState<Record<string, number>>({});
  const isAdmin = role === 'admin';

  const getMarkup = (id: string) => markups[id] ?? defaultMarkupPercent;

  const handlePoll = async () => {
    setPolling(true);
    try {
      await pollReceivedEfactura();
      toast.success('Factură nouă preluată din inbox-ul ANAF (simulare)');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Eroare la verificarea facturilor primite');
    }
    setPolling(false);
  };

  const handleProcess = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const result = await processReceivedInvoice(invoiceId, getMarkup(invoiceId));
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Piese înregistrate în stoc');
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'Eroare la înregistrarea în stoc');
    }
    setProcessingId(null);
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Facturi primite (furnizori)</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Facturi primite prin e-Factura de la furnizori de piese. Furnizorul se înregistrează automat după CUI,
            iar piesele pot fi adăugate în stoc cu un adaos editabil.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handlePoll}
            disabled={polling}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            data-testid="poll-received-invoices"
          >
            {polling ? 'Se verifică...' : 'Simulează primire factură ANAF (test)'}
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="mb-4 p-2 text-xs text-zinc-500">Recepție: acțiunile de înregistrare în stoc sunt ascunse (doar admin).</div>
      )}

      <div className="space-y-4">
        {invoices.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-zinc-500">
            Nicio factură primită încă. {isAdmin && 'Folosește butonul de mai sus pentru a simula primirea uneia.'}
          </div>
        )}

        {invoices.map((inv: any) => {
          const items = inv.received_invoice_items || [];
          const processed = inv.status === 'processed';
          return (
            <div key={inv.id} className="bg-white rounded-2xl p-6" data-testid={`received-invoice-${inv.id}`}>
              <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                <div>
                  <p className="font-medium">
                    {inv.number || inv.external_id} — {inv.suppliers?.name || 'Furnizor necunoscut'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    CUI: {inv.suppliers?.cui || '-'} · {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('ro-RO') : '-'} · Total: {Number(inv.total).toFixed(2)} RON
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 text-xs rounded-full ${processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {processed ? 'Înregistrată în stoc' : 'Nouă'}
                </span>
              </div>

              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b bg-zinc-50 text-left">
                      <th className="p-2">Piesă</th>
                      <th className="p-2 text-right">Cant.</th>
                      <th className="p-2 text-right">Preț ach.</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="p-2">{it.description}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{Number(it.unit_price).toFixed(2)} RON</td>
                        <td className="p-2 text-right">{Number(it.total).toFixed(2)} RON</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isAdmin && !processed && (
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <label className="text-sm flex items-center gap-2">
                    Adaos (%):
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={getMarkup(inv.id)}
                      onChange={(e) => setMarkups({ ...markups, [inv.id]: Number(e.target.value) })}
                      className="w-24 border rounded-lg px-2 py-1"
                      data-testid={`markup-input-${inv.id}`}
                    />
                  </label>
                  <button
                    onClick={() => handleProcess(inv.id)}
                    disabled={processingId === inv.id}
                    className="bg-black text-white px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-zinc-900 disabled:opacity-50"
                    data-testid={`process-received-invoice-${inv.id}`}
                  >
                    {processingId === inv.id ? 'Se înregistrează...' : 'Înregistrează în stoc'}
                  </button>
                </div>
              )}

              {processed && (
                <p className="text-xs text-zinc-500 mt-3">
                  Înregistrată în stoc {inv.processed_at ? `pe ${new Date(inv.processed_at).toLocaleDateString('ro-RO')}` : ''} cu adaos {inv.markup_percent_applied}%.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
