'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { isApp } from '@/lib/desktop';
import { AppIcon, LogOut, Settings, Share2, UserRound, CircleUserRound } from '@/components/ui/icons';
import { Popover } from '@/components/ui/popover';
import { Avatar } from '@/components/account/avatar';
import { DiscordIcon, GoogleIcon } from '@/components/account/provider-icons';
import { toast } from '@/components/ui/toast';
import { signIn, signOut, useAuth, type Provider } from '@/core/auth';
import { accountsEnabled } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';

const noopSubscribe = () => () => {};

const item =
  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-white hover:bg-white/10 cursor-pointer text-left';

/** Shares (or copies) the public profile URL. */
async function shareProfile(username: string) {
  const url = `${window.location.origin}/${username}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `Profil SAKURA de @${username}`, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(url);
  toast('Lien du profil copié');
}

/**
 * Account entry point that replaces the settings gear: avatar when signed in, person icon otherwise.
 * `mobile`: floating top-right button. `sidebar`: bottom of the desktop sidebar.
 */
export function AccountMenu({ placement }: { placement: 'mobile' | 'sidebar' }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  // Inside the desktop app, « Application » (download page) is pointless.
  const inApp = useSyncExternalStore(noopSubscribe, isApp, () => false);

  const mobile = placement === 'mobile';
  const triggerClass = mobile
    ? 'w-11 h-11 rounded-full tab-bar-glass float-glass flex items-center justify-center text-white/90 active:scale-95 transition-transform cursor-pointer overflow-hidden'
    : 'w-12 h-12 rounded-2xl flex items-center justify-center text-[#8E8E93] hover:bg-white/10 hover:text-white transition-colors cursor-pointer';

  // No accounts configured: keep the plain settings link.
  if (!accountsEnabled) {
    return (
      <Link href="/settings" aria-label="Paramètres" title="Paramètres" className={triggerClass}>
        <Settings className={mobile ? 'w-5 h-5' : 'w-6 h-6 opacity-80'} strokeWidth={2} />
      </Link>
    );
  }

  const avatarUrl = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined);
  const name = profile?.display_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '';
  const username = profile?.username;

  return (
    <Popover
      label="Compte"
      side={mobile ? 'bottom' : 'right'}
      align="end"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={() => {
            haptic('selection');
            toggle();
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={user ? `Compte de ${name || 'l’utilisateur'}` : 'Se connecter'}
          title={user ? name : 'Se connecter'}
          className={triggerClass}
        >
          {user ? (
            <Avatar src={avatarUrl} alt="" size={mobile ? 40 : 32} className={mobile ? '' : 'ring-2 ring-white/20'} />
          ) : (
            <CircleUserRound className={mobile ? 'w-5 h-5' : 'w-6 h-6 opacity-80'} strokeWidth={2} />
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="w-60 flex flex-col">
          {loading ? (
            <div className="h-24" />
          ) : user ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar src={avatarUrl} alt="" size={36} />
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-white truncate">{name || 'Sans nom'}</div>
                  {username && <div className="text-[13px] text-[#8E8E93] truncate">@{username}</div>}
                </div>
              </div>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <Link href={username ? `/${username}` : '/onboarding'} onClick={close} className={item}>
                <UserRound className="w-4 h-4" /> Mon profil
              </Link>
              {username && (
                <button
                  type="button"
                  className={item}
                  onClick={() => {
                    close();
                    void shareProfile(username);
                  }}
                >
                  <Share2 className="w-4 h-4" /> Partager mon profil
                </button>
              )}
              {!inApp && (
                <Link href="/app" onClick={close} className={item}>
                  <AppIcon className="w-4 h-4" /> Application
                </Link>
              )}
              <Link href="/settings" onClick={close} className={item}>
                <Settings className="w-4 h-4" /> Paramètres
              </Link>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button
                type="button"
                className={`${item} !text-[#FF6961]`}
                onClick={() => {
                  close();
                  void signOut().then(() => router.refresh());
                }}
              >
                <LogOut className="w-4 h-4" /> Déconnexion
              </button>
            </>
          ) : (
            <>
              {(['discord', 'google'] as Provider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={item}
                  onClick={() => {
                    close();
                    void signIn(p, window.location.pathname + window.location.search).catch(() => toast('Connexion impossible pour le moment'));
                  }}
                >
                  {p === 'discord' ? <DiscordIcon className="w-4 h-4 text-[#5865F2]" /> : <GoogleIcon className="w-4 h-4" />}
                  Continuer avec {p === 'discord' ? 'Discord' : 'Google'}
                </button>
              ))}
              <div className="h-px bg-white/10 my-1 mx-2" />
              {!inApp && (
                <Link href="/app" onClick={close} className={item}>
                  <AppIcon className="w-4 h-4" /> Application
                </Link>
              )}
              <Link href="/settings" onClick={close} className={item}>
                <Settings className="w-4 h-4" /> Paramètres
              </Link>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}
