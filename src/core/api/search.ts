import { fetchAniList, BROWSE_ANIMES } from '@/core/api/anilist';
import type { AnimeSummary } from '@/lib/anime';
import { mergeSearchResults, needsFallback, searchTokens } from '@/lib/search';
import { cartoonSummary, isCartoon, type TmdbCartoon } from '@/lib/cartoons';

const SORT = ['SEARCH_MATCH', 'POPULARITY_DESC'];

async function anilist(search: string, perPage: number): Promise<AnimeSummary[]> {
  try {
    const res = await fetchAniList(BROWSE_ANIMES, { search, page: 1, perPage, sort: SORT });
    return (res?.Page?.media ?? []) as AnimeSummary[];
  } catch {
    return [];
  }
}

/** Japanese titles of the anime TMDB finds for a (often French) query. */
async function tmdbOriginalTitles(query: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/tmdb/search/tv?query=${encodeURIComponent(query)}&language=fr-FR`);
    const data = (await res.json()) as { results?: { original_name?: string; original_language?: string; origin_country?: string[] }[] };
    const names = (data.results ?? [])
      .filter((r) => r.original_language === 'ja' || r.origin_country?.includes('JP'))
      .map((r) => r.original_name)
      .filter((n): n is string => !!n);
    return [...new Set(names)].slice(0, 2);
  } catch {
    return [];
  }
}

/** Western cartoons (TMDB) matching the query: AniList doesn't list them. */
async function cartoons(query: string): Promise<AnimeSummary[]> {
  try {
    const res = await fetch(`/api/tmdb/search/tv?query=${encodeURIComponent(query)}&language=fr-FR`);
    const data = (await res.json()) as { results?: TmdbCartoon[] };
    return (data.results ?? []).filter(isCartoon).slice(0, 10).map(cartoonSummary);
  } catch {
    return [];
  }
}

/**
 * AniList search, made tolerant: when AniList alone finds little, also search each word of the
 * query (« assassin class ») and the Japanese titles of TMDB's French matches (« attaque des titans »),
 * then the matching cartoons.
 */
export async function searchAnime(query: string): Promise<AnimeSummary[]> {
  const [animes, toons] = await Promise.all([searchAniList(query), cartoons(query)]);
  return [...animes, ...toons];
}

async function searchAniList(query: string): Promise<AnimeSummary[]> {
  const primary = await anilist(query, 30);
  if (!needsFallback(primary)) return primary;

  const tokens = searchTokens(query);
  const words = tokens.length > 1 || (tokens[0] && tokens[0] !== query.toLowerCase()) ? tokens.slice(0, 2) : [];
  const [byWord, byFrenchTitle] = await Promise.all([
    Promise.all(words.map((w) => anilist(w, 15))).then((l) => l.flat()),
    tmdbOriginalTitles(query).then((names) => Promise.all(names.map((n) => anilist(n, 4)))).then((l) => l.flat()),
  ]);
  return mergeSearchResults(query, primary, byWord, byFrenchTitle).slice(0, 30);
}
