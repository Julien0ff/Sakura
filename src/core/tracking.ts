/** List tracking rules (statuses, auto-progress, profile blocks). Pure: no `@/` imports, testable with `node --test`. */

export type ListStatus = 'planned' | 'watching' | 'paused' | 'completed' | 'dropped';

export const LIST_STATUSES: ListStatus[] = ['planned', 'watching', 'paused', 'completed', 'dropped'];

export const STATUS_LABELS: Record<ListStatus, string> = {
  planned: 'À voir',
  watching: 'En cours',
  paused: 'En pause',
  completed: 'Terminé',
  dropped: 'Abandonné',
};

export const isListStatus = (v: unknown): v is ListStatus => typeof v === 'string' && (LIST_STATUSES as string[]).includes(v);

/** Status after an episode crosses the "watched" threshold. Completed / dropped are left alone. */
export function nextStatusOnWatched(current: ListStatus | null): ListStatus | null {
  if (current === 'watching' || current === 'completed' || current === 'dropped') return current;
  return 'watching';
}

/**
 * True when (season, episode) is the very last episode of a finished anime:
 * last episode of the last TMDB season (specials, season 0, ignored), or AniList's episode count without TMDB seasons.
 */
export function isFinalEpisode(args: {
  anilistStatus?: string | null;
  tmdbSeasons?: { season_number: number; episode_count?: number }[] | null;
  anilistEpisodes?: number | null;
  season: number;
  episode: number;
}): boolean {
  if (args.anilistStatus !== 'FINISHED') return false;
  const seasons = (args.tmdbSeasons ?? []).filter((s) => s.season_number > 0);
  if (seasons.length > 0) {
    const last = seasons.reduce((a, b) => (b.season_number > a.season_number ? b : a));
    return !!last.episode_count && args.season === last.season_number && args.episode === last.episode_count;
  }
  return !!args.anilistEpisodes && args.season === 1 && args.episode === args.anilistEpisodes;
}

// ───────── Profile blocks ─────────
export type BlockId = 'stats' | 'favorite' | 'watching' | 'completed' | 'top_rated' | 'episode_ratings' | 'planned';
export type Block = { id: BlockId; visible: boolean };

export const DEFAULT_BLOCKS: Block[] = [
  { id: 'stats', visible: true },
  { id: 'favorite', visible: true },
  { id: 'watching', visible: true },
  { id: 'completed', visible: true },
  { id: 'top_rated', visible: true },
  { id: 'episode_ratings', visible: true },
  { id: 'planned', visible: false },
];

export const BLOCK_LABELS: Record<BlockId, string> = {
  stats: 'Statistiques',
  favorite: 'Anime favori',
  watching: 'En cours',
  completed: 'Terminés',
  top_rated: 'Mieux notés',
  episode_ratings: 'Notes d’épisodes',
  planned: 'À voir',
};

/** Accepts `{ blocks: [...] }` or the array itself; keeps valid order, appends missing blocks, drops unknown ones. */
export function normalizeBlocks(raw: unknown): Block[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { blocks?: unknown }).blocks) ? (raw as { blocks: unknown[] }).blocks : null;
  if (!list) return DEFAULT_BLOCKS.map((b) => ({ ...b }));
  const known = new Set(DEFAULT_BLOCKS.map((b) => b.id));
  const out: Block[] = [];
  for (const item of list) {
    const id = (item as { id?: unknown })?.id;
    if (typeof id !== 'string' || !known.has(id as BlockId) || out.some((b) => b.id === id)) continue;
    out.push({ id: id as BlockId, visible: !!(item as { visible?: unknown }).visible });
  }
  for (const d of DEFAULT_BLOCKS) if (!out.some((b) => b.id === d.id)) out.push({ ...d });
  return out;
}
