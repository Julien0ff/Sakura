/**
 * Release notifications in the mobile apps (M2). Phones don't allow a 15-minute background check
 * like the PC app (src-tauri/src/notify.rs): the coming week's releases are scheduled in advance,
 * on every launch and every change of « Ma liste ». Same rules and texts as the PC app.
 * Pure module (no imports) so `node --test` can load it.
 */

/** One week ahead; beyond that the app has to be opened again. */
export const HORIZON_S = 7 * 86_400;
/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_SCHEDULED = 60;
/** Placeholder hour of releases without a time (23:59 Paris): announce them from 00:00. */
const UNKNOWN_HOUR_SHIFT = 23 * 3600 + 59 * 60;

export interface ScheduleTargets {
  anime: { id: number; title: string }[];
  langs: ('vf' | 'vostfr')[];
}

export interface AiringItem {
  mediaId: number;
  episode: number;
  /** Epoch seconds. */
  airingAt: number;
}

export interface PlanningRelease {
  lang: string;
  label: string | null;
  time: string | null;
  /** Epoch seconds (23:59 Paris when the hour isn't announced). */
  airingAt: number;
  anilist: { id: number } | null;
}

export interface ScheduledRelease {
  /** Notification id (Android needs a 32-bit int). */
  id: number;
  /** Epoch milliseconds. */
  at: number;
  title: string;
  body: string;
}

/** FNV-1a hash of the release key, as a positive 31-bit int. */
export function notificationId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

/** Followed releases in (now, now + 7 days], soonest first, at most MAX_SCHEDULED. */
export function upcomingReleases(
  targets: ScheduleTargets,
  airing: AiringItem[],
  planning: PlanningRelease[],
  now: number,
): ScheduledRelease[] {
  const titles = new Map(targets.anime.map((a) => [a.id, a.title]));
  const inWindow = (at: number) => at > now && at <= now + HORIZON_S;
  const out: ScheduledRelease[] = [];

  if (targets.langs.includes('vostfr')) {
    for (const a of airing) {
      const title = titles.get(a.mediaId);
      if (!title || !inWindow(a.airingAt)) continue;
      out.push({ id: notificationId(`a:${a.mediaId}:${a.episode}`), at: a.airingAt * 1000, title, body: `L’épisode ${a.episode} est disponible en VOSTFR.` });
    }
  }
  if (targets.langs.includes('vf')) {
    for (const p of planning) {
      if (p.lang !== 'vf' || !p.anilist) continue;
      const title = titles.get(p.anilist.id);
      const at = p.time === null ? p.airingAt - UNKNOWN_HOUR_SHIFT : p.airingAt;
      if (!title || !inWindow(at)) continue;
      out.push({
        id: notificationId(`v:${p.anilist.id}:${p.airingAt}`),
        at: at * 1000,
        title,
        body: p.label ? `Nouvel épisode en VF (${p.label}).` : 'Nouvel épisode en VF.',
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}
