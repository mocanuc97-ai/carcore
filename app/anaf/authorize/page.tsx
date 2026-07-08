'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';

function AnafAuthorizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAuthorize = () => {
    setLoading(true);
    
    const redirectUri = searchParams.get('redirect_uri') || '/api/anaf/callback';
    const state = searchParams.get('state') || 'demo';
    const tenantId = searchParams.get('tenant_id');

    setTimeout(() => {
      const callback = new URL(redirectUri, window.location.origin);
      callback.searchParams.set('code', 'SIMULATED_ANAF_AUTH_CODE_' + Date.now());
      callback.searchParams.set('state', state);
      if (tenantId) callback.searchParams.set('tenant_id', tenantId);
      // Forward test_expiry for "connect with expiry" browser test simulation
      const testExpiry = searchParams.get('test_expiry');
      if (testExpiry) callback.searchParams.set('test_expiry', testExpiry);

      window.location.href = callback.toString();
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-blue-800 mb-1">ANAF</div>
          <div className="text-sm text-gray-600">Spațiul Privat Virtual</div>
        </div>

        <h1 className="text-xl font-semibold mb-4 text-center">Autorizare acces e-Factura</h1>
        {searchParams.get('tenant_name') && (
          <p className="text-center text-sm mb-2 text-gray-600">Pentru: <strong>{searchParams.get('tenant_name')}</strong></p>
        )}

        <div className="bg-blue-50 p-4 rounded-xl mb-6 text-sm">
          <p><strong>Aplicația CarCore</strong> solicită permisiunea de a:</p>
          <ul className="list-disc ml-5 mt-2 text-xs">
            <li>Trimite facturi electronice</li>
            <li>Verifica statusul facturilor</li>
          </ul>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          {process.env.NODE_ENV === 'production' 
            ? 'Vei fi redirecționat către ANAF SPV pentru autorizare.' 
            : 'Aceasta este o simulare locală a paginii de autorizare ANAF. În producție vei fi redirecționat pe site-ul oficial ANAF.'}
        </div>

        <button
          onClick={handleAuthorize}
          disabled={loading}
          className="w-full bg-blue-700 text-white py-3 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-70"
        >
          {loading ? 'Se autorizează...' : 'Autorizează CarCore'}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full mt-3 text-sm text-gray-600 hover:text-gray-800"
        >
          Anulează
        </button>
      </div>
    </div>
  );
}

export default function AnafAuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div>Se încarcă autorizarea ANAF...</div>
      </div>
    }>
      <AnafAuthorizeContent />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
