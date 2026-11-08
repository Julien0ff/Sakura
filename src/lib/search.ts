/**
 * Search helpers. AniList's search is strict (« assassin class » finds nothing) and only knows
 * Japanese / English titles: when it returns little, the search page adds results found word by
 * word and through TMDB's French titles. Pure module (no imports) so `node --test` can load it.
 */

type Titled = { id: number; title: { english?: string | null; romaji?: string | null } };

/** Below this many AniList results, the fallbacks run too. */
export const FALLBACK_BELOW = 6;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Query words worth searching alone: 3+ letters, accents removed, longest first. */
export function searchTokens(query: string): string[] {
  const words = normalize(query).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return [...new Set(words)].sort((x, y) => y.length - x.length);
}

/** How many query words start a word of the anime's titles. */
export function matchScore(tokens: string[], anime: Titled): number {
  const words = normalize(`${anime.title.english ?? ''} ${anime.title.romaji ?? ''}`).split(/[^a-z0-9]+/);
  return tokens.filter((t) => words.some((w) => w.startsWith(t))).length;
}

export function needsFallback(results: unknown[]): boolean {
  return results.length < FALLBACK_BELOW;
}

/**
 * AniList's own results first (it ranks best), then word-by-word results that match the query
 * (best match first), then TMDB French-title results. No duplicates.
 */
export function mergeSearchResults<T extends Titled>(query: string, primary: T[], byWord: T[], byFrenchTitle: T[]): T[] {
  const tokens = searchTokens(query);
  const seen = new Set<number>();
  const take = (list: T[]) => list.filter((x) => !seen.has(x.id) && (seen.add(x.id), true));
  const words = byWord
    .map((x, i) => ({ x, i, score: matchScore(tokens, x) }))
    .filter((r) => r.score > 0)
    .sort((p, q) => q.score - p.score || p.i - q.i)
    .map((r) => r.x);
  return [...take(primary), ...take(words), ...take(byFrenchTitle)];
}
