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

// Module-level singleton state for the tab's presence channel
let sharedChannel: RealtimeChannel | null = null;
let channelSubscriptionStatus: 'IDLE' | 'SUBSCRIBING' | 'SUBSCRIBED' = 'IDLE';
const presenceStateListeners = new Set<(presences: ActivePresencePayload[]) => void>();
const connectionStatusListeners = new Set<(connected: boolean) => void>();
let latestPresences: ActivePresencePayload[] = [];
let latestPayloadToTrack: ActivePresencePayload | null = null;

function notifyPresenceState() {
  if (!sharedChannel) return;
  const rawState = sharedChannel.presenceState<ActivePresencePayload>();
  const list: ActivePresencePayload[] = [];
  const seen = new Set<string>();

  for (const key of Object.keys(rawState)) {
    const items = rawState[key] as unknown as ActivePresencePayload[];
    if (items && items.length > 0) {
      const latest = items[items.length - 1];
      if (latest && latest.key && !seen.has(latest.key)) {
        seen.add(latest.key);
        list.push(latest);
      }
    }
  }

  list.sort((a, b) => {
    if (a.activity?.isPlaying && !b.activity?.isPlaying) return -1;
    if (!a.activity?.isPlaying && b.activity?.isPlaying) return 1;
    if (!a.isAnonymous && b.isAnonymous) return -1;
    if (a.isAnonymous && !b.isAnonymous) return 1;
    return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
  });

  latestPresences = list;
  presenceStateListeners.forEach((l) => l(list));
}

function getOrCreatePresenceChannel(): RealtimeChannel | null {
  if (!supabase) return null;
  if (sharedChannel) return sharedChannel;

  const sessionKey = getSessionKey();
  const channel = supabase.channel('online-presence', {
    config: {
      presence: {
        key: sessionKey,
      },
    },
  });
  sharedChannel = channel;

  // IMPORTANT: Wire event handlers BEFORE calling subscribe()
  channel
    .on('presence', { event: 'sync' }, notifyPresenceState)
    .on('presence', { event: 'join' }, notifyPresenceState)
    .on('presence', { event: 'leave' }, notifyPresenceState);

  channelSubscriptionStatus = 'SUBSCRIBING';

  channel.subscribe(async (status) => {
    const connected = status === 'SUBSCRIBED';
    channelSubscriptionStatus = connected ? 'SUBSCRIBED' : 'IDLE';
    connectionStatusListeners.forEach((l) => l(connected));
    if (connected) {
      notifyPresenceState();
      if (latestPayloadToTrack && sharedChannel) {
        await sharedChannel.track(latestPayloadToTrack).catch(() => {});
      }
    }
  });

  return channel;
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
    const channel = getOrCreatePresenceChannel();
    if (!channel) return;

    const channelKey = user?.id ? `usr_${user.id}` : sessionKey;
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

    latestPayloadToTrack = payload;

    if (channelSubscriptionStatus === 'SUBSCRIBED') {
      void channel.track(payload).catch(() => {});
    }

    // Periodic heartbeat every 25 seconds
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (channelSubscriptionStatus === 'SUBSCRIBED') {
        void channel.track({
          ...payload,
          lastSeenAt: Date.now(),
        }).catch(() => {});
      }
    }, 25000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user?.id, profile?.username, pathname, searchParams, playbackState, sessionKey, device, connectedAt, profile, user?.email]);

  return null;
}

/** Hook for the Admin panel to subscribe to all online presences in real-time */
export function useOnlineUsers() {
  const [presences, setPresences] = useState<ActivePresencePayload[]>(latestPresences);
  const [isConnected, setIsConnected] = useState(channelSubscriptionStatus === 'SUBSCRIBED');

  useEffect(() => {
    getOrCreatePresenceChannel();

    setPresences(latestPresences);
    setIsConnected(channelSubscriptionStatus === 'SUBSCRIBED');

    const onPresence = (list: ActivePresencePayload[]) => {
      setPresences(list);
    };
    const onConnection = (connected: boolean) => {
      setIsConnected(connected);
    };

    presenceStateListeners.add(onPresence);
    connectionStatusListeners.add(onConnection);

    return () => {
      presenceStateListeners.delete(onPresence);
      connectionStatusListeners.delete(onConnection);
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
