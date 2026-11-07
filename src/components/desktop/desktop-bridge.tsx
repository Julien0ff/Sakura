'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { routeAfterSignIn } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { desktop, isDesktop, RELEASES_URL, type AuthLink, type UpdateInfo } from '@/lib/desktop';

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
    let busy = false;

    const finish = async (link: AuthLink) => {
      if (busy) return;
      if (link.error || !link.code) {
        toast(`Connexion impossible : ${link.error ?? 'lien invalide'}`);
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
        toast(`Connexion impossible : ${(e as Error).message}`);
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

  return null;
}
