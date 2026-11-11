/**
 * Western cartoons (Gumball, The Owl House…): AniList doesn't list them, TMDB does. They live in
 * the same pages, list and history as the anime, with a negative id (−TMDB id) so the two never
 * collide. This module turns TMDB shows into the AniList shapes the site uses.
 * Pure module (no imports) so `node --test` can load it.
 */

export type TmdbCartoon = {
  id: number;
  name?: string;
  original_name?: string;
  original_language?: string;
  origin_country?: string[];
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  first_air_date?: string;
};

export type TmdbCartoonDetails = TmdbCartoon & {
  status?: string;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
  networks?: { name: string }[];
  seasons?: { season_number: number; name: string; air_date?: string | null; episode_count?: number }[];
  external_ids?: { imdb_id?: string | null };
};

const ANIMATION = 16;
/** Japanese, Korean and Chinese animation comes from AniList. */
const ASIAN_COUNTRIES = ['JP', 'KR', 'CN', 'TW'];
const ASIAN_LANGUAGES = ['ja', 'ko', 'zh', 'cn'];
/** TMDB keyword « anime »: kept out of Découvrir › Dessins animés. */
const ANIME_KEYWORD = 210024;
const IMG = 'https://image.tmdb.org/t/p/';

export const cartoonId = (tmdbId: number) => -tmdbId;
export const isCartoonId = (id: number) => id < 0;
export const tmdbIdOf = (id: number) => -id;

export function isCartoon(show: TmdbCartoon): boolean {
  if (show.genre_ids && !show.genre_ids.includes(ANIMATION)) return false;
  if (show.original_language && ASIAN_LANGUAGES.includes(show.original_language)) return false;
  return !show.origin_country?.some((c) => ASIAN_COUNTRIES.includes(c));
}

const image = (size: string, path?: string | null) => (path ? `${IMG}${size}${path}` : null);
const year = (date?: string) => (date ? Number(date.slice(0, 4)) || null : null);

export function cartoonSummary(show: TmdbCartoon) {
  return {
    id: cartoonId(show.id),
    title: { english: show.name || show.original_name || null, romaji: show.original_name || show.name || null, native: null },
    coverImage: { extraLarge: image('w500', show.poster_path), large: image('w342', show.poster_path), color: null },
    bannerImage: image('w1280', show.backdrop_path) || image('original', show.backdrop_path),
    description: show.overview || null,
    format: 'TV',
    seasonYear: year(show.first_air_date),
    averageScore: show.vote_average ? Math.round(show.vote_average * 10) : null,
  };
}

export function cartoonStatus(status?: string): string {
  if (status === 'Returning Series') return 'RELEASING';
  if (status === 'Ended') return 'FINISHED';
  if (status === 'Canceled') return 'CANCELLED';
  return 'NOT_YET_RELEASED';
}

/** The anime page's data (AniList Media + the TMDB fields it adds) for a cartoon. */
export function cartoonMedia(d: TmdbCartoonDetails) {
  const [y, m, day] = (d.first_air_date ?? '').split('-').map(Number);
  return {
    ...cartoonSummary(d),
    idMal: null,
    status: cartoonStatus(d.status),
    episodes: d.number_of_episodes ?? null,
    duration: null,
    popularity: null,
    trailer: null,
    startDate: { year: y || null, month: m || null, day: day || null },
    genres: (d.genres ?? []).map((g) => g.name),
    studios: { nodes: (d.networks ?? []).map((n) => ({ name: n.name })) },
    relations: { edges: [] as never[] },
    tmdbId: d.id,
    tmdbTitle: d.name,
    tmdbDescription: d.overview,
    tmdbSeasons: (d.seasons ?? []).filter((s) => s.season_number > 0),
    imdbId: d.external_ids?.imdb_id ?? undefined,
  };
}

const SORTS: Record<string, string> = {
  POPULARITY_DESC: 'popularity.desc',
  TRENDING_DESC: 'popularity.desc',
  SCORE_DESC: 'vote_average.desc',
  START_DATE_DESC: 'first_air_date.desc',
};

/** Query string of TMDB `discover/tv` for Découvrir › Dessins animés. */
export function discoverQuery(sort: string, page: number): string {
  const q = new URLSearchParams({
    with_genres: String(ANIMATION),
    without_keywords: String(ANIME_KEYWORD),
    sort_by: SORTS[sort] ?? 'popularity.desc',
    language: 'fr-FR',
    page: String(page),
  });
  if (sort === 'SCORE_DESC') q.set('vote_count.gte', '200');
  if (sort === 'START_DATE_DESC') {
    q.set('first_air_date.lte', new Date().toISOString().slice(0, 10));
    q.set('vote_count.gte', '20');
  }
  return q.toString();
}
