'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/core/auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
  type: DeviceType;
  os: string;
  browser: string;
  label: string;
}

export interface UserActivity {
  path: string;
  title: string;
  details?: string;
  isPlaying?: boolean;
}

export interface ActivePresencePayload {
  key: string;
  userId: string | null;
  username: string;
  avatarUrl?: string | null;
  isAnonymous: boolean;
  isAdmin?: boolean;
  device: DeviceInfo;
  activity: UserActivity;
  connectedAt: number;
  lastSeenAt: number;
}

/** Detect OS, device form factor, and browser / app environment */
export function detectDevice(): DeviceInfo {
  if (typeof navigator === 'undefined') {
    return { type: 'desktop', os: 'Inconnu', browser: 'Web', label: 'Desktop' };
  }
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints || 0;

  let os = 'Inconnu';
  let type: DeviceType = 'desktop';

  if (/android/i.test(ua)) {
    os = 'Android';
    type = /tablet|sm-t|gt-p/i.test(ua) ? 'tablet' : 'mobile';
  } else if (/iphone/i.test(ua)) {
    os = 'iOS';
    type = 'mobile';
  } else if (/ipad/i.test(ua) || (touch > 1 && /macintosh|mac os x/i.test(ua))) {
    os = 'iPadOS';
    type = 'tablet';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
    type = 'desktop';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
    type = 'desktop';
  } else if (/linux|x11|cros/i.test(ua)) {
    os = 'Linux';
    type = 'desktop';
  }

  const isNative = typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI__?: unknown; Capacitor?: unknown }).__TAURI__ || (window as unknown as { Capacitor?: unknown }).Capacitor);
  let browser = 'Web';
  if (isNative) {
    browser = 'App';
  } else if (/edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/opr\//i.test(ua)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua)) {
    browser = 'Safari';
  }

  return {
    type,
    os,
    browser,
    label: `${os} · ${browser}`,
  };
}

/** Stable session ID stored in sessionStorage so guests have a persistent badge within a session */
function getSessionKey(): string {
  if (typeof window === 'undefined') return 'guest_init';
  try {
    let key = sessionStorage.getItem('sakura_presence_session');
    if (!key) {
      key = `gst_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
      sessionStorage.setItem('sakura_presence_session', key);
    }
    return key;
  } catch {
    return 'guest_tab';
  }
}

/** Translates standard SAKURA routes into human-readable activity descriptions */
export function getActivityForPath(pathname: string, searchParams?: URLSearchParams | null): UserActivity {
  if (!pathname || pathname === '/') {
    return { path: '/', title: 'Page d\'accueil', details: 'Parcourt le catalogue' };
  }
  if (pathname === '/search') {
    const q = searchParams?.get('q');
    return { path: pathname, title: 'Recherche', details: q ? `« ${q} »` : 'Recherche un anime' };
  }
  if (pathname === '/discover') {
    return { path: pathname, title: 'Découvrir', details: 'Explore les genres' };
  }
  if (pathname === '/calendar') {
    return { path: pathname, title: 'Calendrier', details: 'Consulte les sorties' };
  }
  if (pathname === '/watchlist') {
    return { path: pathname, title: 'Ma liste', details: 'Gère sa liste' };
  }
  if (pathname === '/history') {
    return { path: pathname, title: 'Historique', details: 'Revoit son historique' };
  }
  if (pathname === '/settings') {
    return { path: pathname, title: 'Paramètres', details: 'Configure son SAKURA' };
  }
  if (pathname === '/admin') {
    return { path: pathname, title: 'Administration', details: 'Gère le site' };
  }
  if (pathname === '/app') {
    return { path: pathname, title: 'Application', details: 'Découvre les applications' };
  }
  if (pathname.startsWith('/anime')) {
    return { path: pathname, title: 'Fiche anime / dessin animé', details: 'Consulte une fiche' };
  }
  return { path: pathname, title: pathname.replace('/', ''), details: 'Navigation' };
}

// Global active player state override (set when player is open)
let activePlaybackOverride: { title: string; details: string; isPlaying: boolean } | null = null;
const playbackListeners = new Set<() => void>();

export function setOnlinePlaybackActivity(override: { title: string; details: string; isPlaying: boolean } | null) {
  activePlaybackOverride = override;
  playbackListeners.forEach((l) => l());
}

/** Hook mounted globally in <Providers> to publish real-time presence */
export function OnlinePresenceTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [device] = useState(detectDevice);
  const [sessionKey] = useState(getSessionKey);
  const [playbackState, setPlaybackState] = useState(activePlaybackOverride);

  useEffect(() => {
    const listener = () => setPlaybackState(activePlaybackOverride);
    playbackListeners.add(listener);
    return () => {
      playbackListeners.delete(listener);
    };
  }, []);

  const connectedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!supabase) return;

    const channelName = 'online-presence';
    const channelKey = user?.id ? `usr_${user.id}` : sessionKey;
    const channel: RealtimeChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: channelKey,
        },
      },
    });

    const isAnon = !user;
    const username = profile?.username || (isAnon ? `Invité #${sessionKey.slice(-4)}` : user.email?.split('@')[0] || 'Utilisateur');
    const avatarUrl = profile?.banner_id?.startsWith('default:') ? null : (profile as unknown as { avatar_url?: string })?.avatar_url || null;
    const isAdmin = Boolean((profile as unknown as { is_admin?: boolean; role?: string })?.is_admin || (profile as unknown as { role?: string })?.role === 'admin');

    const rawActivity = getActivityForPath(pathname, searchParams);
    const activity: UserActivity = playbackState
      ? {
          path: pathname,
          title: playbackState.title,
          details: playbackState.details,
          isPlaying: playbackState.isPlaying,
        }
      : rawActivity;

    const payload: ActivePresencePayload = {
      key: channelKey,
      userId: user?.id ?? null,
      username,
      avatarUrl,
      isAnonymous: isAnon,
      isAdmin,
      device,
      activity,
      connectedAt,
      lastSeenAt: Date.now(),
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(payload);
        // Periodic heartbeat every 25 seconds
        intervalId = setInterval(() => {
          if (typeof document !== 'undefined' && document.hidden) return;
          void channel.track({
            ...payload,
            lastSeenAt: Date.now(),
          });
        }, 25000);
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      void channel.untrack().catch(() => {});
      void channel.unsubscribe();
    };
  }, [user?.id, profile?.username, pathname, searchParams, playbackState, sessionKey, device, connectedAt, profile, user?.email]);

  return null;
}

/** Hook for the Admin panel to subscribe to all online presences in real-time */
export function useOnlineUsers() {
  const [presences, setPresences] = useState<ActivePresencePayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const channelName = 'online-presence';
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const syncState = () => {
      const state = channel.presenceState<ActivePresencePayload>();
      const list: ActivePresencePayload[] = [];
      const seen = new Set<string>();

      for (const key of Object.keys(state)) {
        const items = state[key];
        if (items && items.length > 0) {
          // Take the most recent presence for this key
          const latest = items[items.length - 1];
          if (latest && !seen.has(latest.key)) {
            seen.add(latest.key);
            list.push(latest);
          }
        }
      }

      // Sort: users currently watching video first, then members, then guests, by lastSeenAt
      list.sort((a, b) => {
        if (a.activity.isPlaying && !b.activity.isPlaying) return -1;
        if (!a.activity.isPlaying && b.activity.isPlaying) return 1;
        if (!a.isAnonymous && b.isAnonymous) return -1;
        if (a.isAnonymous && !b.isAnonymous) return 1;
        return b.lastSeenAt - a.lastSeenAt;
      });

      setPresences(list);
    };

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          syncState();
        }
      });

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  const membersCount = presences.filter((p) => !p.isAnonymous).length;
  const guestsCount = presences.filter((p) => p.isAnonymous).length;

  return {
    users: presences,
    total: presences.length,
    membersCount,
    guestsCount,
    isConnected,
  };
}
