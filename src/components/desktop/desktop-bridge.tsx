'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { routeAfterSignIn } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { desktop, isDesktop, isLiteRendering, RELEASES_URL, type AuthLink, type UpdateInfo } from '@/lib/desktop';
import { useAppStore, useHydrated } from '@/core/store';
import { notifyTargets } from '@/lib/notify-targets';
import { buildBrowsingPresence } from '@/lib/presence';
import { configurePresence, SESSION_START, setPagePresence } from './presence-manager';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

/** Offers an update found by the app (startup + every 6 h, or « Rechercher » in Settings). */
export function announceUpdate(info: UpdateInfo) {
  toast(`SAKURA ${info.version} est disponible`, {
    action: info.installable
      ? {
          label: 'Redémarrer',
          onClick: () => {
            toast('Téléchargement de la mise à jour… SAKURA va redémarrer.');
            desktop.installUpdate().catch((e) => toast(`Mise à jour impossible : ${String(e)}`));
          },
        }
      : { label: 'Télécharger', onClick: () => void desktop.openExternal(RELEASES_URL).catch(() => {}) },
  });
}

/**
 * Desktop app only (renders nothing): finishes the system-browser sign-in coming back through
 * sakura://auth/callback, and relays update notices.
 */
export function DesktopBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isDesktop()) return;
    if (isLiteRendering()) document.documentElement.classList.add('app-lite');
    let busy = false;
    // The same link can arrive twice (live event + pending slot): a code is only redeemed once.
    let lastCode: string | null = null;

    const finish = async (link: AuthLink) => {
      if (busy || (link.code && link.code === lastCode)) return;
      lastCode = link.code;
      if (link.error || !link.code) {
        toast(`Connexion impossible : ${link.error ?? 'lien invalide'}`, { action: { label: 'OK', onClick: () => {} } });
        return;
      }
      if (!supabase) return;
      busy = true;
      try {
        // The PKCE verifier was stored by this webview when the sign-in started.
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        if (error) throw error;
        await routeAfterSignIn((p) => router.replace(p), safeNext(link.next));
        toast('Connecté');
      } catch (e) {
        toast(`Connexion impossible : ${(e as Error).message}`, { action: { label: 'OK', onClick: () => {} } });
      } finally {
        busy = false;
      }
    };

    const unlisteners: Promise<() => void>[] = [
      desktop.onAuthCallback((link) => {
        // The live event and the pending slot carry the same link: clear the slot.
        void desktop.takePendingAuth();
        void finish(link);
      }),
      desktop.onUpdateAvailable(announceUpdate),
    ];
    // Cold start: the link arrived before this page was listening.
    void desktop.takePendingAuth().then((link) => link && finish(link));

    return () => unlisteners.forEach((u) => void u.then((f) => f()));
  }, [router]);

  return (
    <>
      <NotifyTargetsSync />
      <PagePresence />
    </>
  );
}

/** Discord « Regarde SAKURA · Parcourt le catalogue » for the current page (anime pages set their own). */
function PagePresence() {
  const pathname = usePathname();
  const enabled = useAppStore((s) => s.settings.discordPresence ?? true);
  const browsing = useAppStore((s) => s.settings.discordBrowsing ?? true);

  useEffect(() => configurePresence({ enabled, browsing }), [enabled, browsing]);
  useEffect(() => {
    if (!isDesktop() || pathname === '/anime') return;
    setPagePresence(buildBrowsingPresence({ path: pathname, since: SESSION_START, origin: window.location.origin }));
  }, [pathname]);

  return null;
}

/** Keeps the app's release-notification list in sync with « Ma liste » and the settings. */
function NotifyTargetsSync() {
  const hydrated = useHydrated();
  const watchlist = useAppStore((s) => s.watchlist);
  const enabled = useAppStore((s) => s.settings.releaseNotifications ?? true);
  const lang = useAppStore((s) => s.settings.notifyLang ?? 'auto');
  const defaultLang = useAppStore((s) => s.settings.defaultLang);

  useEffect(() => {
    if (!hydrated || !isDesktop()) return;
    // Debounced: list edits come in bursts (sync pulls, status changes).
    const t = setTimeout(() => void desktop.setNotifyTargets(notifyTargets(watchlist, { enabled, lang, defaultLang })), 1000);
    return () => clearTimeout(t);
  }, [hydrated, watchlist, enabled, lang, defaultLang]);

  return null;
}
