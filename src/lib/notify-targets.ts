/**
 * Release notifications (apps): which anime and languages the app watches, and when to keep quiet.
 * Pure module (no imports) so `node --test` can load it.
 */

type Lang = 'vf' | 'vostfr';
export type NotifyLang = 'auto' | 'all' | Lang;

/** Followed statuses: « En cours » and « À voir ». */
const FOLLOWED = new Set(['watching', 'planned']);

/** Ne pas déranger, in minutes since midnight (device time) and the device's UTC offset. */
export interface QuietWindow {
  start: number;
  end: number;
  /** Minutes east of UTC (Paris in winter: 60), so the PC app can compare without a timezone database. */
  utcOffset: number;
}

export interface NotifyTargets {
  anime: { id: number; title: string }[];
  langs: Lang[];
  quiet: QuietWindow | null;
}

const minutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 24 * 60 ? v : null;
};

export function notifyTargets(
  watchlist: { id: number; title: string; listStatus: string }[],
  opts: {
    enabled: boolean;
    lang: NotifyLang;
    defaultLang: Lang;
    /** Calendar › « Prévenez-moi » (not in the list). */
    extra?: { id: number; title: string }[];
    quietHours?: { enabled: boolean; start: string; end: string };
    /** `-new Date().getTimezoneOffset()` */
    utcOffset?: number;
  }
): NotifyTargets {
  if (!opts.enabled) return { anime: [], langs: [], quiet: null };
  const langs: Lang[] = opts.lang === 'all' ? ['vostfr', 'vf'] : opts.lang === 'auto' ? [opts.defaultLang] : [opts.lang];
  const anime = watchlist.filter((a) => FOLLOWED.has(a.listStatus)).map((a) => ({ id: a.id, title: a.title }));
  for (const a of opts.extra ?? []) if (!anime.some((x) => x.id === a.id)) anime.push({ id: a.id, title: a.title });

  const q = opts.quietHours;
  const start = q?.enabled ? minutes(q.start) : null;
  const end = q?.enabled ? minutes(q.end) : null;
  const quiet = start !== null && end !== null && start !== end ? { start, end, utcOffset: opts.utcOffset ?? 0 } : null;
  return { anime, langs, quiet };
}

/** Minutes since local midnight of an epoch (seconds), in the window's timezone. */
const localMinutes = (epochS: number, utcOffset: number) => ((Math.floor(epochS / 60) + utcOffset) % 1440 + 1440) % 1440;

/** Whether an instant falls in the quiet window (which may cross midnight: 23:00 → 08:00). */
export function inQuietHours(epochS: number, q: QuietWindow | null): boolean {
  if (!q) return false;
  const m = localMinutes(epochS, q.utcOffset);
  return q.start < q.end ? m >= q.start && m < q.end : m >= q.start || m < q.end;
}

/** A release due during quiet hours moves to the end of them; otherwise unchanged. Epoch seconds. */
export function afterQuietHours(epochS: number, q: QuietWindow | null): number {
  if (!q || !inQuietHours(epochS, q)) return epochS;
  const m = localMinutes(epochS, q.utcOffset);
  const wait = (q.end - m + 1440) % 1440;
  return (Math.floor(epochS / 60) + wait) * 60;
}
