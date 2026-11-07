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

async function fetchPlanning(): Promise<PlanningRelease[]> {
  const res = await fetch('/api/planning');
  if (!res.ok) throw new Error(`planning ${res.status}`);
  return (await res.json()) as PlanningRelease[];
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
async function ensurePermission(): Promise<boolean> {
  if (await invoke<boolean | null>('plugin:notification|is_permission_granted')) return true;
  return (await invoke<string>('plugin:notification|request_permission')) === 'granted';
}

/**
 * Replaces the scheduled notifications with the followed releases of the next 7 days.
 * Throws when offline / an API fails: the previous schedule is then kept.
 */
export async function syncScheduledReleases(targets: NotifyTargets): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const wants = (l: 'vf' | 'vostfr') => targets.langs.includes(l);
  const ids = targets.anime.map((a) => a.id);
  const empty = ids.length === 0 || targets.langs.length === 0;

  const [airing, planning] = empty
    ? [[], []]
    : await Promise.all([wants('vostfr') ? fetchAiring(ids, now, now + HORIZON_S + 1) : [], wants('vf') ? fetchPlanning() : []]);
  const list = upcomingReleases(targets, airing, planning, now);

  const previous = previousIds();
  if (previous.length) await invoke('plugin:notification|cancel', { notifications: previous });
  localStorage.setItem(STORE_KEY, '[]');
  if (!list.length || !(await ensurePermission())) return 0;

  const scheduled: number[] = [];
  for (const n of list) {
    try {
      await invoke('plugin:notification|notify', {
        options: { id: n.id, title: n.title, body: n.body, autoCancel: true, schedule: { at: { date: new Date(n.at).toISOString(), allowWhileIdle: true } } },
      });
      scheduled.push(n.id);
    } catch {
      /* one bad entry doesn't stop the others */
    }
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(scheduled));
  return scheduled.length;
}
