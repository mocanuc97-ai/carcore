import { createTenantAndProfile } from '../actions';
import { redirect } from 'next/navigation';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function handleSubmit(formData: FormData) {
    'use server';

    const result = await createTenantAndProfile(formData);

    if (result.error) {
      // For simplicity in this version we redirect with message via query (can improve later)
      redirect(`/register?error=${encodeURIComponent(result.error)}`);
    }

    if (result.success) {
      redirect(`/login?success=${encodeURIComponent('Cont creat cu succes. Autentifică-te acum.')}`);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-2xl font-semibold mb-2 text-black">Creează un service nou</h2>
      <p className="text-sm text-zinc-600 mb-6">Înregistrează-ți service-ul auto în CarCore</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Nume Service</label>
          <input
            name="serviceName"
            type="text"
            required
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-black"
            placeholder="Service Auto Pro"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Nume Administrator</label>
          <input
            name="fullName"
            type="text"
            defaultValue="Administrator"
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email Administrator</label>
          <input
            name="email"
            type="email"
            required
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-black"
            placeholder="admin@service.ro"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Parolă</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-black"
            placeholder="Minim 6 caractere"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-zinc-900"
        >
          Creează contul service-ului
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-zinc-600">Ai deja cont? </span>
        <a href="/login" className="text-black font-medium hover:underline">Autentifică-te</a>
      </div>
    </div>
  );
}
