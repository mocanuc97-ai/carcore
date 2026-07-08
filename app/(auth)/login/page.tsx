'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Autentificat cu succes!');
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-black">Autentificare</h2>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="admin@service.ro"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Parolă</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-zinc-900 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Se autentifică...' : 'Intră în cont'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-zinc-600">Nu ai cont? </span>
        <a href="/register" className="text-black font-medium hover:underline">
          Creează un service nou
        </a>
      </div>

      <div className="mt-4 text-xs text-center text-zinc-500">
        Demo: După sign up, folosește Studio pentru a crea userul și a-l lega la tenant.
      </div>
    </div>
  );
}
