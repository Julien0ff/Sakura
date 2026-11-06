'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import { refreshProfile } from '@/core/auth';

function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get('error_description'));

  useEffect(() => {
    if (error || !supabase) return;
    const next = safeNext(params.get('next'));
    (async () => {
      // getSession() resolves after the client has exchanged the ?code= (detectSessionInUrl).
      const { data, error: e } = await supabase.auth.getSession();
      if (e || !data.session) {
        setError(e?.message ?? 'La connexion a échoué.');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.session.user.id).maybeSingle();
      await refreshProfile();
      router.replace(profile?.username ? next : `/onboarding?next=${encodeURIComponent(next)}`);
    })();
  }, [error, params, router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-white text-lg font-semibold">Connexion impossible</p>
          <p className="text-[#8E8E93] text-sm max-w-sm">{error}</p>
          <Link href="/settings" className="mt-2 px-5 h-11 inline-flex items-center rounded-full bg-white/10 text-white font-semibold">
            Retour aux paramètres
          </Link>
        </>
      ) : (
        <>
          <span className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" aria-hidden />
          <p className="text-[#8E8E93] text-sm">Connexion en cours…</p>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <AppLayout>
      <Suspense fallback={null}>
        <Callback />
      </Suspense>
    </AppLayout>
  );
}
