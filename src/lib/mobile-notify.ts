/**
 * Mobile apps (M2): schedules the coming week's releases as local notifications. Runs on every
 * launch / return to the app and on every change of « Ma liste » (see DesktopBridge).
 */
import { invoke } from '@tauri-apps/api/core';
import type { NotifyTargets } from '@/lib/notify-targets';
import { HORIZON_S, upcomingReleases, type AiringItem, type PlanningRelease } from '@/lib/release-schedule';

/** Ids scheduled last time: replaced as a whole on every sync. */
const STORE_KEY = 'sakura.scheduledReleases';

const AIRING_QUERY = `query ($ids: [Int], $from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt mediaId }
  }
}`;

async function fetchAiring(ids: number[], from: number, to: number): Promise<AiringItem[]> {
  ids = ids.filter((id) => id > 0); // cartoons (negative ids) aren't on AniList
  if (ids.length === 0) return [];
  const out: AiringItem[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: AIRING_QUERY, variables: { ids, from, to, page } }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const json = (await res.json()) as { data?: { Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: AiringItem[] } } };
    if (!json.data) throw new Error('AniList: no data');
    out.push(...json.data.Page.airingSchedules);
    if (!json.data.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

async function fetchAiringSafe(ids: number[], from: number, to: number): Promise<AiringItem[]> {
  try {
    return await fetchAiring(ids, from, to);
  } catch (e) {
    console.warn('[mobile-notify] fetchAiring failed:', e);
    return [];
  }
}

async function fetchPlanning(): Promise<PlanningRelease[]> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${origin}/api/planning`);
  if (!res.ok) throw new Error(`planning ${res.status}`);
  return (await res.json()) as PlanningRelease[];
}

async function fetchPlanningSafe(): Promise<PlanningRelease[]> {
  try {
    return await fetchPlanning();
  } catch (e) {
    console.warn('[mobile-notify] fetchPlanning failed:', e);
    return [];
  }
}

function previousIds(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}

/** Asks once (Android 13+, iOS). false when refused: nothing is scheduled. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const granted = await invoke<boolean | null>('plugin:notification|is_permission_granted');
    if (granted === true) return true;
    const req = await invoke<string>('plugin:notification|request_permission');
    return req === 'granted';
  } catch (e) {
    console.warn('[mobile-notify] permission check error:', e);
    return false;
  }
}

/**
 * Sends an immediate local test notification to verify delivery on device.
 */
export async function sendTestNotification(): Promise<boolean> {
  try {
    const hasPerm = await ensureNotificationPermission();
    if (!hasPerm) return false;
    await invoke('plugin:notification|notify', {
      options: {
        id: Math.floor(Math.random() * 100000) + 1,
        title: '🌸 SAKURA — Notification de test',
        body: 'Les notifications de sortie sont bien configurées et fonctionnent sur votre appareil !',
        autoCancel: true,
        channelId: 'default',
      },
    });
    return true;
  } catch (e) {
    console.warn('[mobile-notify] sendTestNotification failed:', e);
    return false;
  }
}

/**
 * Replaces the scheduled notifications with the followed releases of the next 7 days.
 * Kept resilient so network/API errors do not crash caller threads.
 */
export async function syncScheduledReleases(targets: NotifyTargets): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const wants = (l: 'vf' | 'vostfr') => targets.langs.includes(l);
  const ids = targets.anime.map((a) => a.id);
  const empty = ids.length === 0 || targets.langs.length === 0;

  const [airing, planning] = empty
    ? [[], []]
    : await Promise.all([
        wants('vostfr') ? fetchAiringSafe(ids, now, now + HORIZON_S + 1) : [],
        wants('vf') ? fetchPlanningSafe() : [],
      ]);
  const list = upcomingReleases(targets, airing, planning, now);

  const previous = previousIds();
  if (previous.length) {
    try {
      await invoke('plugin:notification|cancel', { notifications: previous });
    } catch {
      /* ignore cancel error on devices without cancel support */
    }
  }

  localStorage.setItem(STORE_KEY, '[]');
  if (!list.length) return 0;

  const hasPerm = await ensureNotificationPermission();
  if (!hasPerm) return 0;

  const scheduled: number[] = [];
  for (const n of list) {
    try {
      await invoke('plugin:notification|notify', {
        options: {
          id: n.id,
          title: n.title,
          body: n.body,
          autoCancel: true,
          channelId: 'default',
          schedule: {
            at: {
              date: new Date(n.at).toISOString(),
              allowWhileIdle: true,
            },
          },
        },
      });
      scheduled.push(n.id);
    } catch (err) {
      console.warn(`[mobile-notify] Failed to schedule release ${n.id}:`, err);
    }
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(scheduled));
  return scheduled.length;
}
