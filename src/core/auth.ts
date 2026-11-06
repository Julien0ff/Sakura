'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;
export type Provider = 'discord' | 'google';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session has been read once. */
  loading: boolean;
}

export const useAuthStore = create<AuthState>(() => ({ session: null, profile: null, loading: true }));

async function loadProfile(userId: string) {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  // Ignore a late answer for a user who has since signed out / switched.
  if (useAuthStore.getState().session?.user.id === userId) useAuthStore.setState({ profile: data ?? null });
}

export async function refreshProfile() {
  const uid = useAuthStore.getState().session?.user.id;
  if (uid) await loadProfile(uid);
}

export function useAuth(): AuthState & { user: User | null; refreshProfile: () => Promise<void> } {
  const state = useAuthStore();
  return { ...state, user: state.session?.user ?? null, refreshProfile };
}

/** Where the OAuth provider sends the user back. `next` is a same-origin path. */
export function callbackUrl(next?: string) {
  const u = new URL('/auth/callback', window.location.origin);
  if (next && next.startsWith('/') && !next.startsWith('//')) u.searchParams.set('next', next);
  return u.toString();
}

export async function signIn(provider: Provider, next?: string) {
  if (!supabase) throw new Error('Comptes indisponibles');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(next), scopes: provider === 'discord' ? 'identify email' : undefined },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  // Push pending changes before the local copy is wiped.
  const { flushNow } = await import('@/core/sync/engine');
  await flushNow().catch(() => {});
  await supabase.auth.signOut();
}

/** Mounted once in <Providers>: mirrors the Supabase session into useAuthStore. */
export function AuthBootstrap() {
  useEffect(() => {
    if (!supabase) {
      useAuthStore.setState({ loading: false });
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const prev = useAuthStore.getState().session?.user.id;
      useAuthStore.setState({ session, loading: false, ...(session?.user.id !== prev ? { profile: null } : {}) });
      // Supabase warns against awaiting other client calls inside this callback.
      if (session && session.user.id !== prev) setTimeout(() => loadProfile(session.user.id), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
