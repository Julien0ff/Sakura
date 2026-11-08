// All TMDB calls go through our server proxy (src/app/api/tmdb), which adds the token
// from TMDB_READ_TOKEN. No key is shipped to the browser.
import { pickShow, showTitle, type TmdbShow } from '@/lib/seasons';

const TMDB_BASE_URL = '/api/tmdb';

interface TMDBResult {
  id: number;
  origin_country?: string[];
  original_language?: string;
}

interface TMDBSeason {
  season_number: number;
  name: string;
  episode_count?: number;
  air_date?: string | null;
}

export interface TMDBDetails {
  id: number;
  type: 'tv' | 'movie';
  title?: string;
  description?: string;
  rating?: number;
  imdbId?: string;
  seasons: TMDBSeason[];
}

const isJapanese = (r: TMDBResult) => !!r.origin_country?.includes('JP') || r.original_language === 'ja';

// In-memory cache: the home page asks for the same titles in several rows.
const detailsCache = new Map<string, Promise<TMDBDetails | null>>();

export function getTMDBDetails(title: string, year?: number | null): Promise<TMDBDetails | null> {
  const key = `${title}|${year ?? ''}`;
  let pending = detailsCache.get(key);
  if (!pending) {
    pending = fetchTMDBDetails(title, year ?? undefined);
    detailsCache.set(key, pending);
  }
  return pending;
}

async function fetchTMDBDetails(title: string, year?: number): Promise<TMDBDetails | null> {
  try {
    const searchQuery = encodeURIComponent(title);

    // First search for TV show: the full title, then without AniList's season marker
    // (« … Second Season » is season 2 of the TMDB show).
    let tvData: { results?: TmdbShow[] } = {};
    let matched = title;
    for (const q of new Set([title, showTitle(title)])) {
      const tvRes = await fetch(`${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(q)}&language=fr-FR`);
      tvData = await tvRes.json();
      matched = q;
      if (tvData.results?.length) break;
    }

    const bestResult = pickShow(tvData.results ?? [], matched);
    if (bestResult) {
      const tvId = bestResult.id;
      // Fetch full TV details to get seasons and IMDB ID
      const fullTvRes = await fetch(`${TMDB_BASE_URL}/tv/${tvId}?language=fr-FR&append_to_response=external_ids`);
      const fullTvData = await fullTvRes.json();
      
      return {
        id: tvId,
        type: 'tv' as const,
        title: fullTvData.name,
        description: fullTvData.overview,
        rating: fullTvData.vote_average,
        imdbId: fullTvData.external_ids?.imdb_id,
        seasons: ((fullTvData.seasons || []) as TMDBSeason[]).filter((s) => s.season_number > 0) // Filter out specials
      };
    }
    
    // Fallback to Movies
    // Year only for movies: for TV, AniList's seasonYear is the season's year, not the show's first air date.
    const yearQuery = year ? `&primary_release_year=${year}` : '';
    const movieRes = await fetch(`${TMDB_BASE_URL}/search/movie?query=${searchQuery}${yearQuery}&language=fr-FR`);
    const movieData = await movieRes.json();
    
    if (movieData.results && movieData.results.length > 0) {
      // Find the first result that is actually Japanese (Anime)
      let bestMovie: TMDBResult = (movieData.results as TMDBResult[]).find(isJapanese) ?? movieData.results[0];
      
      if (!bestMovie) {
        bestMovie = movieData.results[0];
      }

      const movieId = bestMovie.id;
      const fullMovieRes = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?language=fr-FR&append_to_response=external_ids`);
      const fullMovieData = await fullMovieRes.json();

      return {
        id: movieId,
        type: 'movie' as const,
        title: fullMovieData.title,
        description: fullMovieData.overview,
        rating: fullMovieData.vote_average,
        imdbId: fullMovieData.external_ids?.imdb_id,
        seasons: [] // Movies don't have seasons
      };
    }
    
    return null;
  } catch (error) {
    console.error('TMDB Error:', error);
    return null;
  }
}

export async function getTMDBSeasonEpisodes(tmdbId: number, seasonNumber: number) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?language=fr-FR`);
    const data = await res.json();
    return data.episodes || [];
  } catch (error) {
    console.error('TMDB Season Error:', error);
    return [];
  }
}

const titleCache = new Map<string, Promise<string | null>>();

/** Lightweight lookup (1 request, cached) for the French title, used by list rows. */
export function getTMDBFrenchTitle(title: string): Promise<string | null> {
  let pending = titleCache.get(title);
  if (!pending) {
    pending = fetch(`${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(title)}&language=fr-FR`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const results = (data?.results ?? []) as (TMDBResult & { name?: string })[];
        return (results.find(isJapanese) ?? null)?.name ?? null;
      })
      .catch(() => null);
    titleCache.set(title, pending);
  }
  return pending;
}
