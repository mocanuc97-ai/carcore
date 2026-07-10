'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { importClientsAndVehicles, type ImportResult } from './actions';

export default function ImportClientsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Selectează un fișier CSV');
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await importClientsAndVehicles(formData);
      setResult(res);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Import finalizat');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eroare la import');
    }
    setLoading(false);
  };

  return (
    <div>
      <Link href="/clients" className="text-sm text-blue-600">← Înapoi la clienți</Link>

      <h1 className="text-2xl font-semibold mt-4 mb-2">Import clienți și mașini</h1>
      <p className="text-zinc-600 text-sm mb-6">
        Adaugă în masă clienți și mașini dintr-un fișier CSV — util dacă service-ul are deja o bază de date
        (Excel, alt program). Exportă datele existente ca CSV și încarcă-le mai jos.
      </p>

      <div className="bg-white rounded-2xl p-6 mb-6">
        <h3 className="font-medium mb-2">1. Descarcă șablonul</h3>
        <p className="text-sm text-zinc-600 mb-3">
          Fiecare rând reprezintă o mașină; dacă un client are mai multe mașini, repetă datele clientului pe mai multe rânduri
          (vezi exemplul din șablon). Coloanele <code className="bg-zinc-100 px-1 rounded">nume_client</code>,{' '}
          <code className="bg-zinc-100 px-1 rounded">telefon_client</code>, <code className="bg-zinc-100 px-1 rounded">marca</code> și{' '}
          <code className="bg-zinc-100 px-1 rounded">model</code> sunt obligatorii; restul sunt opționale. Coloana{' '}
          <code className="bg-zinc-100 px-1 rounded">tip_client</code> acceptă <code className="bg-zinc-100 px-1 rounded">persoana_fizica</code>{' '}
          sau <code className="bg-zinc-100 px-1 rounded">persoana_juridica</code> (implicit persoană fizică dacă lipsește); pentru firme
          completează și <code className="bg-zinc-100 px-1 rounded">cui</code>.
        </p>
        <a
          href="/templates/import-clienti-masini.csv"
          download
          className="inline-block px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-medium"
        >
          Descarcă șablon CSV
        </a>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium mb-4">2. Încarcă fișierul completat</h3>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            required
            className="border rounded-xl px-4 py-2 text-sm"
            data-testid="import-file-input"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            data-testid="import-submit"
          >
            {loading ? 'Se importă...' : 'Importă'}
          </button>
        </form>

        {result && !result.error && (
          <div className="mt-6 border-t pt-4 text-sm space-y-1" data-testid="import-summary">
            <p className="font-medium mb-2">Rezultat import:</p>
            <p>✅ Clienți noi creați: <strong>{result.clientsCreated}</strong></p>
            <p>↺ Clienți deja existenți (identificați după telefon): <strong>{result.clientsMatched}</strong></p>
            <p>✅ Mașini noi create: <strong>{result.vehiclesCreated}</strong></p>
            {result.vehiclesSkippedDuplicate > 0 && (
              <p>⏭ Mașini ignorate (VIN sau nr. înmatriculare deja existent): <strong>{result.vehiclesSkippedDuplicate}</strong></p>
            )}
            {result.rowErrors.length > 0 && (
              <div className="mt-3">
                <p className="text-red-600 font-medium">Rânduri cu erori ({result.rowErrors.length}):</p>
                <ul className="list-disc list-inside text-red-600 text-xs mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                  {result.rowErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
