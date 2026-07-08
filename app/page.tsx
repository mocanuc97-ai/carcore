export default function CarCoreLanding() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
      <div className="max-w-2xl text-center">
        <div className="inline-block px-4 py-1 rounded-full bg-white/10 text-sm mb-6">
          SaaS pentru service-uri auto din România
        </div>

        <h1 className="text-6xl font-semibold tracking-tighter mb-4">
          CarCore
        </h1>
        <p className="text-2xl text-zinc-400 mb-8">
          Programări • Istoric intervenții cu poze • Facturare + e-Factura
        </p>

        <p className="text-lg text-zinc-400 max-w-md mx-auto mb-10">
          Sistem complet pentru administratori și recepție. 
          Gestionare clienți, mașini (cu serie caroserie), intervenții, programări și facturi.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-base font-medium text-black hover:bg-zinc-200 transition-colors">
            Creează un service nou
          </a>
          <a href="/login" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-8 text-base font-medium hover:bg-white/5 transition-colors">
            Autentifică-te
          </a>
        </div>

        <div className="mt-12 text-xs text-zinc-500 max-w-xs mx-auto">
          Dezvoltat local cu Next.js + Supabase. 
          Pentru testare completă: după înregistrare folosește Supabase Studio la http://127.0.0.1:54323.
        </div>
      </div>
    </div>
  );
}
