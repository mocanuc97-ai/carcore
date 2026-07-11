'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { processReceivedInvoice } from './actions';

interface ReceivedInvoiceCardProps {
  invoice: any;
  defaultMarkupPercent: number;
  isAdmin: boolean;
  onProcessed: () => void;
}

// Split out of ReceivedInvoicesClient so the markup input's own state stays
// local to its card — typing in one invoice's adaos field no longer
// re-renders every other card (and its items table) in the list.
export default function ReceivedInvoiceCard({ invoice: inv, defaultMarkupPercent, isAdmin, onProcessed }: ReceivedInvoiceCardProps) {
  const [markup, setMarkup] = useState(defaultMarkupPercent);
  const [processing, setProcessing] = useState(false);

  const items = inv.received_invoice_items || [];
  const processed = inv.status === 'processed';
  const isError = inv.status === 'error';

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const result = await processReceivedInvoice(inv.id, markup);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Piese înregistrate în stoc');
        onProcessed();
      }
    } catch (err: any) {
      toast.error(err.message || 'Eroare la înregistrarea în stoc');
    }
    setProcessing(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6" data-testid={`received-invoice-${inv.id}`}>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
        <div>
          <p className="font-medium">
            {inv.number || inv.external_id} — {inv.suppliers?.name || 'Furnizor necunoscut'}
          </p>
          <p className="text-xs text-zinc-500">
            CUI: {inv.suppliers?.cui || '-'} · {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('ro-RO') : '-'} · Total: {Number(inv.total).toFixed(2)} RON
          </p>
        </div>
        <span className={`px-2.5 py-0.5 text-xs rounded-full ${processed ? 'bg-green-100 text-green-700' : isError ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {processed ? 'Înregistrată în stoc' : isError ? 'Eroare — reîncearcă' : 'Nouă'}
        </span>
      </div>
      {isError && (
        <p className="text-xs text-red-600 mb-3">
          Înregistrarea a eșuat parțial. Piesele deja înregistrate cu succes nu vor fi duplicate la reîncercare.
        </p>
      )}

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
              value={markup}
              onChange={(e) => setMarkup(Number(e.target.value))}
              className="w-24 border rounded-lg px-2 py-1"
              data-testid={`markup-input-${inv.id}`}
            />
          </label>
          <button
            onClick={handleProcess}
            disabled={processing}
            className="bg-black text-white px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-zinc-900 disabled:opacity-50"
            data-testid={`process-received-invoice-${inv.id}`}
          >
            {processing ? 'Se înregistrează...' : isError ? 'Reîncearcă înregistrarea' : 'Înregistrează în stoc'}
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
}
