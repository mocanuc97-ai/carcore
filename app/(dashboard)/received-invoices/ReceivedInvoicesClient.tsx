'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { pollReceivedEfactura } from './actions';
import ReceivedInvoiceCard from './ReceivedInvoiceCard';

interface ReceivedInvoicesClientProps {
  invoices: any[];
  defaultMarkupPercent: number;
  role: 'admin' | 'reception';
}

export default function ReceivedInvoicesClient({ invoices, defaultMarkupPercent, role }: ReceivedInvoicesClientProps) {
  const router = useRouter();
  const [polling, setPolling] = useState(false);
  const isAdmin = role === 'admin';

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

        {invoices.map((inv: any) => (
          <ReceivedInvoiceCard
            key={inv.id}
            invoice={inv}
            defaultMarkupPercent={defaultMarkupPercent}
            isAdmin={isAdmin}
            onProcessed={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}
