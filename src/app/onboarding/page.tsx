'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/account/avatar';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { normalizeUsername, suggestUsername, usernameProblem } from '@/lib/username';
import { haptic } from '@/lib/haptics';

type Check = { state: 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'; message?: string };
/** Last server answer, for the name it was about. */
type Remote = { name: string; available: boolean | null };

function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { user, profile, loading, refreshProfile } = useAuth();

  const suggestion = useMemo(() => (user ? suggestUsername(user.user_metadata ?? {}) : ''), [user]);
  const [value, setValue] = useState<string | null>(null);
  const name = value ?? suggestion;
  const [remote, setRemote] = useState<Remote | null>(null);
  const problem = name ? usernameProblem(name) : null;
  const check: Check = !name
    ? { state: 'idle' }
    : problem
      ? { state: 'invalid', message: problem }
      : remote?.name !== name
        ? { state: 'checking' }
        : remote.available === null
          ? { state: 'idle' }
          : remote.available
            ? { state: 'ok', message: 'Disponible' }
            : { state: 'taken', message: 'Ce pseudo est déjà pris.' };
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Not signed in → settings (where the sign-in buttons live). Already onboarded → go on.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/settings');
    else if (profile?.username) router.replace(next);
  }, [loading, user, profile, next, router]);

  // Live availability (debounced 300 ms).
  useEffect(() => {
    if (!supabase || !name || problem) return;
    const client = supabase;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error } = await client.rpc('username_available', { name });
      if (cancelled) return;
      setRemote({ name, available: error ? null : !!data });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, problem]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || check.state !== 'ok') return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('profiles').update({ username: name }).eq('id', user.id);
    setSaving(false);
    if (error) {
      haptic('warning');
      setSaveError(error.code === '23505' ? 'Ce pseudo vient d’être pris.' : 'Impossible d’enregistrer le pseudo. Réessayez.');
      if (error.code === '23505') setRemote({ name, available: false });
      return;
    }
    haptic('success');
    await refreshProfile();
    router.replace(next);
  };

  if (loading || !user) return <div className="min-h-[60vh]" />;

  const tone =
    check.state === 'ok' ? 'text-[#30D158]' : check.state === 'taken' || check.state === 'invalid' ? 'text-[#FF6961]' : 'text-[#8E8E93]';
  const displayName = profile?.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? '';

  return (
    <div className="px-6 md:pl-32 pr-6 pt-[max(env(safe-area-inset-top),40px)] pb-32 flex justify-center">
      <form onSubmit={submit} className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <Avatar src={profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined)} alt={displayName} size={88} />
        <div>
          <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'var(--font-impact)' }}>
            Choisissez votre pseudo
          </h1>
          <p className="mt-2 text-[15px] text-[#8E8E93]">
            Il sera visible sur votre profil et dans son adresse.
          </p>
        </div>

        <div className="w-full text-left">
          <label htmlFor="username" className="px-1 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">
            Pseudo
          </label>
          <div className="mt-2 flex items-center rounded-2xl bg-white/[0.06] border border-white/[0.08] focus-within:border-white/30 px-4 h-14">
            <span className="text-[#8E8E93] text-[17px]" aria-hidden>
              @
            </span>
            <input
              id="username"
              value={name}
              onChange={(e) => setValue(normalizeUsername(e.target.value))}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              aria-describedby="username-status"
              aria-invalid={check.state === 'taken' || check.state === 'invalid'}
              className="flex-1 min-w-0 bg-transparent text-white text-[17px] outline-none ml-1"
            />
          </div>
          <p id="username-status" role="status" className={`px-1 mt-2 text-[13px] min-h-[18px] ${tone}`}>
            {check.state === 'checking' ? 'Vérification…' : check.message ?? '3 à 20 caractères : lettres minuscules, chiffres et _'}
          </p>
          {saveError && <p className="px-1 text-[13px] text-[#FF6961]">{saveError}</p>}
        </div>

        <button
          type="submit"
          disabled={check.state !== 'ok' || saving}
          className="w-full h-12 rounded-full bg-white text-black font-bold text-[16px] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {saving ? 'Enregistrement…' : 'Continuer'}
        </button>
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AppLayout>
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    </AppLayout>
  );
}
