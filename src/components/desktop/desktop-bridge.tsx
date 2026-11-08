'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { routeAfterSignIn } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { desktop, isApp, isDesktop, isLiteRendering, isMobileApp, RELEASES_URL, type AuthLink, type UpdateInfo } from '@/lib/desktop';
import { useAppStore, useHydrated } from '@/core/store';
import { notifyTargets } from '@/lib/notify-targets';
import { syncScheduledReleases } from '@/lib/mobile-notify';
import { checkAndroidUpdate, type MobileUpdate } from '@/lib/mobile-update';
import { buildBrowsingPresence } from '@/lib/presence';
import { configurePresence, SESSION_START, setPagePresence } from './presence-manager';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

/** Android: offers the new .apk (the phone's browser downloads it, Android asks to install it). */
export function announceAndroidUpdate(u: MobileUpdate) {
  toast(`SAKURA ${u.version} est disponible`, {
    action: {
      label: 'Télécharger',
      onClick: () =>
        void desktop
          .openExternal(u.url)
          .then(() => toast('Ouvrez le fichier téléchargé pour installer la mise à jour.'))
          .catch(() => toast('Téléchargement impossible pour le moment')),
    },
  });
}

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
 * SAKURA apps only (renders nothing on the website): finishes the system-browser sign-in coming
 * back through sakura://auth/callback (desktop and mobile); desktop also gets update notices,
 * release notifications and the Discord status.
 */
export function DesktopBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isApp()) return;
    if (isLiteRendering()) document.documentElement.classList.add('app-lite');
    if (isMobileApp()) {
      const html = document.documentElement;
      html.classList.add('app-mobile');
      // Some Android WebViews report a 0 safe area while drawing under the status bar.
      if (/Android/i.test(navigator.userAgent)) {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
        document.body.appendChild(probe);
        if (probe.getBoundingClientRect().height === 0) html.style.setProperty('--android-status', '28px');
        probe.remove();
      }
    }

    // Mobile apps have no second window: target="_blank" links open in the phone's browser.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
      if (!a || !/^https:\/\//.test(a.href)) return;
      e.preventDefault();
      void desktop.openExternal(a.href).catch(() => {});
    };
    if (isMobileApp()) document.addEventListener('click', onClick, true);
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
      ...(isDesktop() ? [desktop.onUpdateAvailable(announceUpdate)] : []),
    ];
    // Cold start: the link arrived before this page was listening.
    void desktop.takePendingAuth().then((link) => link && finish(link));
    // Android: a newer .apk on GitHub? (iPhone: AltStore / SideStore handle updates.)
    let offered: string | null = null;
    let lastCheck = 0;
    const checkUpdate = () => {
      lastCheck = Date.now();
      void checkAndroidUpdate()
        .then((u) => {
          if (!u || u.version === offered) return;
          offered = u.version;
          announceAndroidUpdate(u);
        })
        .catch(() => {});
    };
    const updateCheck = setTimeout(checkUpdate, 5000);
    // Phones keep the app suspended for days: check again when it comes back after an hour.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 3_600_000) checkUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(updateCheck);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('click', onClick, true);
      unlisteners.forEach((u) => void u.then((f) => f()));
    };
  }, [router]);

  return (
    <>
      <div className="status-edge" aria-hidden />
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
    if (!isApp() || pathname === '/anime') return;
    setPagePresence(buildBrowsingPresence({ path: pathname, since: SESSION_START, origin: window.location.origin }));
  }, [pathname]);

  return null;
}

/**
 * Keeps release notifications in sync with « Ma liste » and the settings: the PC app gets the
 * list to watch, the mobile apps schedule the coming week.
 */
function NotifyTargetsSync() {
  const hydrated = useHydrated();
  const watchlist = useAppStore((s) => s.watchlist);
  const enabled = useAppStore((s) => s.settings.releaseNotifications ?? true);
  const lang = useAppStore((s) => s.settings.notifyLang ?? 'auto');
  const defaultLang = useAppStore((s) => s.settings.defaultLang);

  useEffect(() => {
    if (!hydrated || !isApp()) return;
    const targets = notifyTargets(watchlist, { enabled, lang, defaultLang });
    // PC: the app checks every 15 min itself. Phones: the coming week is scheduled in advance.
    const sync = isDesktop()
      ? () => void desktop.setNotifyTargets(targets)
      : () => void syncScheduledReleases(targets).catch(() => {});
    // Debounced: list edits come in bursts (sync pulls, status changes).
    const t = setTimeout(sync, 1500);
    if (isDesktop()) return () => clearTimeout(t);

    // Back to the app after a while (phones keep it suspended): refresh the week ahead.
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 3_600_000) return;
      last = Date.now();
      sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hydrated, watchlist, enabled, lang, defaultLang]);

  return null;
}
