/**
 * AniList has one entry per season (« Assassination Classroom », « … Second Season »); TMDB has
 * one show with seasons, which the anime page lists. Seasons are matched by air date.
 * Pure module (no imports) so `node --test` can load it.
 */

export type FuzzyDate = { year?: number | null; month?: number | null; day?: number | null } | null | undefined;
export type TmdbSeason = { season_number: number; air_date?: string | null };
export type Relation = { relationType: string; node: { format?: string | null; startDate?: FuzzyDate } };

/** AniList and TMDB dates can differ by a few weeks (pre-airing, time zones). */
const TOLERANCE_DAYS = 45;
const DAY = 86_400_000;
const SEASON_FORMATS = ['TV', 'TV_SHORT', 'ONA'];

function time(d: FuzzyDate): number | null {
  if (!d?.year || !d.month) return null;
  return Date.UTC(d.year, d.month - 1, d.day ?? 1);
}

/** The TMDB season that started with this AniList entry (closest air date, within 45 days), or null. */
export function matchingSeason(seasons: TmdbSeason[], start: FuzzyDate): number | null {
  const t = time(start);
  if (t === null) return null;
  let best: { n: number; gap: number } | null = null;
  for (const s of seasons) {
    if (!s.air_date) continue;
    const gap = Math.abs(Date.parse(s.air_date) - t);
    if (gap <= TOLERANCE_DAYS * DAY && (!best || gap < best.gap)) best = { n: s.season_number, gap };
  }
  return best?.n ?? null;
}

/** A sequel / prequel season that the page already lists as one of its seasons (hidden from relations). */
export function isListedSeason(edge: Relation, seasons: TmdbSeason[]): boolean {
  return (
    seasons.length > 1 &&
    (edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL') &&
    SEASON_FORMATS.includes(edge.node.format ?? '') &&
    matchingSeason(seasons, edge.node.startDate) !== null
  );
}

/** Season markers AniList puts after the show's name (« Second Season », « Season 3 Part 2 », « II »…). */
const SEASON_SUFFIX =
  /(?:\s*:)?\s+(?:(?:the\s+)?(?:final|\d+(?:st|nd|rd|th)|second|third|fourth|fifth|sixth)\s+season|season\s*\d+|part\s*\d+|cour\s*\d+|II|III|IV|V|VI)\b.*$/i;

/** The show's title without the season marker, for TMDB (which has one show with seasons). */
export function showTitle(title: string): string {
  const stripped = title.replace(SEASON_SUFFIX, '').trim();
  return stripped || title;
}

export type TmdbShow = { id: number; name?: string; original_name?: string; original_language?: string; origin_country?: string[]; vote_count?: number };

const plain = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, '');

/**
 * The TMDB search result for an anime: among Japanese shows, the one named exactly like the title
 * (« Naruto », not « Naruto Shippuden »), else the most voted (TMDB lists spin-offs and specials
 * before « L'Attaque des Titans » for « Attack on Titan »). No Japanese show: the first result.
 */
export function pickShow<T extends TmdbShow>(results: T[], title: string): T | null {
  const japanese = results.filter((r) => r.original_language === 'ja' || r.origin_country?.includes('JP'));
  if (japanese.length === 0) return results[0] ?? null;
  const t = plain(title);
  return (
    japanese.find((r) => plain(r.name) === t || plain(r.original_name) === t) ??
    japanese.reduce((best, r) => ((r.vote_count ?? 0) > (best.vote_count ?? 0) ? r : best))
  );
}

/** A later part of the last season can come this long after its start (AoT Final Season: 13 months). */
const LAST_SEASON_SPAN_DAYS = 550;

/**
 * Season the page opens on for an AniList entry: the matching season, else the one in progress at
 * its start (« Season 3 Part 2 » → season 3), else 1.
 */
export function openingSeason(seasons: TmdbSeason[], start: FuzzyDate): number {
  const exact = matchingSeason(seasons, start);
  if (exact !== null) return exact;
  const t = time(start);
  if (t === null) return 1;
  const dated = seasons
    .filter((s) => s.air_date)
    .map((s) => ({ n: s.season_number, at: Date.parse(s.air_date!) }))
    .sort((a, b) => a.at - b.at);
  const i = dated.findLastIndex((s) => s.at <= t);
  if (i < 0) return 1;
  const isLast = i === dated.length - 1;
  return !isLast || t - dated[i].at <= LAST_SEASON_SPAN_DAYS * DAY ? dated[i].n : 1;
}
