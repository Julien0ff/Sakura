/**
 * Release notifications (desktop app): which anime and languages the app watches.
 * Pure module (no imports) so `node --test` can load it.
 */

type Lang = 'vf' | 'vostfr';
export type NotifyLang = 'auto' | 'all' | Lang;

/** Followed statuses: « En cours » and « À voir ». */
const FOLLOWED = new Set(['watching', 'planned']);

export interface NotifyTargets {
  anime: { id: number; title: string }[];
  langs: Lang[];
}

export function notifyTargets(
  watchlist: { id: number; title: string; listStatus: string }[],
  opts: { enabled: boolean; lang: NotifyLang; defaultLang: Lang }
): NotifyTargets {
  if (!opts.enabled) return { anime: [], langs: [] };
  const langs: Lang[] = opts.lang === 'all' ? ['vostfr', 'vf'] : opts.lang === 'auto' ? [opts.defaultLang] : [opts.lang];
  return {
    anime: watchlist.filter((a) => FOLLOWED.has(a.listStatus)).map((a) => ({ id: a.id, title: a.title })),
    langs,
  };
}
