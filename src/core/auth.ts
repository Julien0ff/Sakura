'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { desktop, isApp } from '@/lib/desktop';
import { appRedirectUrl } from '@/lib/app-auth';

export type Profile = Tables<'profiles'>;
export type Provider = 'discord' | 'google';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session has been read once. */
  loading: boolean;
}

export const useAuthStore = create<AuthState>(() => ({ session: null, profile: null, loading: true }));

/** Photo uploaded in Settings › Compte (Supabase Storage); anything else comes from Discord / Google. */
const isUploadedAvatar = (url: string) => url.includes('/storage/v1/object/public/avatars/');

/**
 * The profile keeps the provider's photo URL from the sign-up. After a new Discord / Google photo,
 * that URL dies (Discord deletes old avatars): take the one Supabase got at the last sign-in.
 */
async function syncProviderAvatar(profile: Profile | null): Promise<Profile | null> {
  if (!supabase || !profile) return profile;
  // From the server, not the stored session: a device signed in long ago must not bring back an old photo.
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || user.id !== profile.id) return profile;
  const fresh = (user.user_metadata?.avatar_url ?? user.user_metadata?.picture) as string | undefined;
  const current = profile.avatar_url;
  if (!fresh || fresh === current || (current && isUploadedAvatar(current))) return profile;
  const { error } = await supabase.from('profiles').update({ avatar_url: fresh }).eq('id', user.id);
  return error ? profile : { ...profile, avatar_url: fresh };
}

async function loadProfile(userId: string) {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  const session = useAuthStore.getState().session;
  // Ignore a late answer for a user who has since signed out / switched.
  if (session?.user.id !== userId) return;
  useAuthStore.setState({ profile: data ?? null });
  const synced = await syncProviderAvatar(data ?? null).catch(() => data ?? null);
  if (synced !== data && useAuthStore.getState().session?.user.id === userId) useAuthStore.setState({ profile: synced });
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

const scopesFor = (provider: Provider) => (provider === 'discord' ? 'identify email' : undefined);

/**
 * Desktop app: Google refuses embedded webviews, so the provider page opens in the system browser
 * and comes back through /auth/app → sakura:// (see <DesktopBridge/>). Returns true when handed off.
 */
async function openInSystemBrowser(url: string | undefined) {
  if (!url) throw new Error('Lien de connexion manquant');
  await desktop.openExternal(url);
  const { toast } = await import('@/components/ui/toast');
  toast('Continuez dans votre navigateur');
}

export async function signIn(provider: Provider, next?: string) {
  if (!supabase) throw new Error('Comptes indisponibles');
  if (isApp()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: appRedirectUrl(window.location.origin, next), scopes: scopesFor(provider), skipBrowserRedirect: true },
    });
    if (error) throw error;
    return openInSystemBrowser(data.url);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(next), scopes: scopesFor(provider) },
  });
  if (error) throw error;
}

/** Adds another provider to the signed-in account (Settings › Compte). */
export async function linkProvider(provider: Provider, next = '/settings') {
  if (!supabase) throw new Error('Comptes indisponibles');
  if (isApp()) {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: appRedirectUrl(window.location.origin, next), scopes: scopesFor(provider), skipBrowserRedirect: true },
    });
    if (error) throw error;
    return openInSystemBrowser(data.url);
  }
  const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: callbackUrl(next) } });
  if (error) throw error;
}

/** After a session exists: pick a username first if needed, else go to `next`. */
export async function routeAfterSignIn(navigate: (path: string) => void, next: string) {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle();
  await refreshProfile();
  navigate(profile?.username ? next : `/onboarding?next=${encodeURIComponent(next)}`);
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
