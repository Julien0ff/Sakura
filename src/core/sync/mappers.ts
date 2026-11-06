/**
 * Store ⇄ Row<T> ⇄ Postgres row conversions. Pure (type-only imports) so `node --test` can load it.
 * Keys: `w:<animeId>` watchlist, `h:<animeId>` history, `p:<animeId>:<season>:<episode>` progress,
 * `r:<animeId>:<season>:<episode>` episode ratings.
 */
import type { Row } from './merge.ts';
import type { EpisodeProgress, EpisodeRating, HistoryEntry, SavedAnime, Settings, SyncSnapshot } from '../store.ts';
import { isListStatus } from '../tracking.ts';
import type { Tables, TablesInsert } from '../../lib/database.types.ts';

export type ProgressValue = EpisodeProgress & { key: string };
export type EpisodeRatingValue = EpisodeRating & { key: string };

export interface SyncRows {
  watchlist: Row<SavedAnime>[];
  history: Row<HistoryEntry>[];
  progress: Row<ProgressValue>[];
  episodeRatings: Row<EpisodeRatingValue>[];
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string | null | undefined) => (s ? Date.parse(s) : 0);
const idOf = (key: string) => Number(key.split(':')[1]);

/** Store keys use `animeId:season:episode`; sync keys add the `p:` prefix. */
export const progressRowKey = (storeKey: string) => `p:${storeKey}`;

export function localRows(s: SyncSnapshot): SyncRows {
  const tombs = (prefix: string) =>
    Object.entries(s.deleted)
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, at]) => ({ key, value: null, updatedAt: at }));
  return {
    watchlist: [...s.watchlist.map((a) => ({ key: `w:${a.id}`, value: a, updatedAt: a.updatedAt })), ...tombs('w:')],
    history: [...s.history.map((h) => ({ key: `h:${h.id}`, value: h, updatedAt: h.watchedAt })), ...tombs('h:')],
    progress: Object.entries(s.progress).map(([k, p]) => ({ key: progressRowKey(k), value: { ...p, key: k }, updatedAt: p.updatedAt })),
    episodeRatings: [
      ...Object.entries(s.episodeRatings).map(([k, r]) => ({ key: `r:${k}`, value: { ...r, key: k }, updatedAt: r.updatedAt })),
      ...tombs('r:'),
    ],
  };
}

export function snapshotFromRows(rows: SyncRows, settings: Settings, settingsUpdatedAt: number): SyncSnapshot {
  const deleted: Record<string, number> = {};
  const watchlist: SavedAnime[] = [];
  const history: HistoryEntry[] = [];
  const progress: Record<string, EpisodeProgress> = {};
  const episodeRatings: Record<string, EpisodeRating> = {};
  for (const r of rows.watchlist) {
    if (r.value) watchlist.push(r.value);
    else deleted[r.key] = r.updatedAt;
  }
  for (const r of rows.history) {
    if (r.value) history.push(r.value);
    else deleted[r.key] = r.updatedAt;
  }
  for (const r of rows.progress) {
    if (!r.value) continue;
    const { key, ...p } = r.value;
    progress[key] = p;
  }
  for (const r of rows.episodeRatings) {
    if (!r.value) {
      deleted[r.key] = r.updatedAt;
      continue;
    }
    const { key, ...v } = r.value;
    episodeRatings[key] = v;
  }
  watchlist.sort((a, b) => b.updatedAt - a.updatedAt);
  history.sort((a, b) => b.watchedAt - a.watchedAt);
  return { watchlist, history: history.slice(0, 100), progress, episodeRatings, deleted, settings, settingsUpdatedAt };
}

// ───────── watchlist_entries ─────────
export function watchlistToDb(r: Row<SavedAnime>): TablesInsert<'watchlist_entries'> {
  const a = r.value;
  return {
    anime_id: idOf(r.key),
    title: a?.title ?? null,
    cover: a?.cover ?? null,
    color: a?.color ?? null,
    score: a?.score ?? null,
    status: a?.status ?? null,
    list_status: a?.listStatus ?? 'planned',
    rating: a?.rating ?? null,
    favorite: a?.favorite ?? false,
    completed_on_sakura_at: a?.completedOnSakuraAt ? iso(a.completedOnSakuraAt) : null,
    updated_at: iso(r.updatedAt),
    deleted_at: a ? null : iso(r.updatedAt),
  };
}

export function watchlistFromDb(d: Tables<'watchlist_entries'>): Row<SavedAnime> {
  const updatedAt = ms(d.updated_at);
  const value: SavedAnime | null = d.deleted_at
    ? null
    : {
        id: d.anime_id,
        title: d.title ?? '',
        cover: d.cover ?? '',
        updatedAt,
        ...opt(d),
        listStatus: isListStatus(d.list_status) ? d.list_status : 'planned',
        ...(d.rating != null ? { rating: d.rating } : {}),
        ...(d.favorite ? { favorite: true } : {}),
        ...(d.completed_on_sakura_at ? { completedOnSakuraAt: ms(d.completed_on_sakura_at) } : {}),
      };
  return { key: `w:${d.anime_id}`, value, updatedAt };
}

// ───────── history_entries ─────────
export function historyToDb(r: Row<HistoryEntry>): TablesInsert<'history_entries'> {
  const h = r.value;
  return {
    anime_id: idOf(r.key),
    title: h?.title ?? null,
    cover: h?.cover ?? null,
    color: h?.color ?? null,
    score: h?.score ?? null,
    status: h?.status ?? null,
    episode_number: h?.episodeNumber ?? null,
    episode_name: h?.episodeName ?? null,
    season: h?.season ?? null,
    lang: h?.lang ?? null,
    watched_at: h ? iso(h.watchedAt) : null,
    updated_at: iso(r.updatedAt),
    deleted_at: h ? null : iso(r.updatedAt),
  };
}

export function historyFromDb(d: Tables<'history_entries'>): Row<HistoryEntry> {
  const updatedAt = ms(d.updated_at);
  const value: HistoryEntry | null = d.deleted_at
    ? null
    : {
        id: d.anime_id,
        title: d.title ?? '',
        cover: d.cover ?? '',
        ...opt(d),
        episodeNumber: d.episode_number ?? 1,
        episodeName: d.episode_name ?? '',
        season: d.season ?? 1,
        lang: d.lang === 'vf' ? 'vf' : 'vostfr',
        watchedAt: ms(d.watched_at) || updatedAt,
      };
  return { key: `h:${d.anime_id}`, value, updatedAt };
}

// ───────── episode_progress ─────────
export function progressToDb(r: Row<ProgressValue>): TablesInsert<'episode_progress'> | null {
  if (!r.value) return null;
  const [animeId, season, episode] = r.value.key.split(':').map(Number);
  return { anime_id: animeId, season, episode, time: r.value.time, duration: r.value.duration, updated_at: iso(r.updatedAt) };
}

export function progressFromDb(d: Tables<'episode_progress'>): Row<ProgressValue> {
  const key = `${d.anime_id}:${d.season}:${d.episode}`;
  const updatedAt = ms(d.updated_at);
  return { key: progressRowKey(key), value: { key, time: d.time, duration: d.duration, updatedAt }, updatedAt };
}

/** Optional AnimeRef fields: only set when the DB has them (keeps round-trips equal). */
function opt(d: { color: string | null; score: number | null; status: string | null }) {
  return {
    ...(d.color != null ? { color: d.color } : {}),
    ...(d.score != null ? { score: d.score } : {}),
    ...(d.status != null ? { status: d.status } : {}),
  };
}

// ───────── episode_ratings ─────────
export function episodeRatingToDb(r: Row<EpisodeRatingValue>): TablesInsert<'episode_ratings'> {
  const [animeId, season, episode] = r.key.slice(2).split(':').map(Number);
  return {
    anime_id: animeId,
    season,
    episode,
    rating: r.value ? r.value.rating : null,
    updated_at: iso(r.updatedAt),
    deleted_at: r.value ? null : iso(r.updatedAt),
  };
}

export function episodeRatingFromDb(d: Tables<'episode_ratings'>): Row<EpisodeRatingValue> {
  const key = `${d.anime_id}:${d.season}:${d.episode}`;
  const updatedAt = ms(d.updated_at);
  return {
    key: `r:${key}`,
    value: d.deleted_at || d.rating == null ? null : { key, rating: d.rating, updatedAt },
    updatedAt,
  };
}
