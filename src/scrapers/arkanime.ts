import { AnimeScraper, AnimeEpisode, ScraperInfo, VideoSource } from './types';

export class ArkanimeScraper implements AnimeScraper {
  info: ScraperInfo = {
    name: 'Arkanime',
    baseUrl: 'https://arkanim.net',
    lang: ['vostfr', 'vf'], // Arkanime has both depending on the anime
  };

  async search(query: string) {
    try {
      const url = `${this.info.baseUrl}/api/anime?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data || !data.results) return [];

      const results: { title: string; url: string; poster?: string }[] = [];
      for (const result of data.results) {
        results.push({
          title: result.titleEnglish || result.titleRomaji || result.titleNative,
          url: String(result.id), // Arkanim ID
          poster: result.coverImage
        });
      }

      return results;
    } catch (e) {
      console.error('Arkanime search error:', e);
      return [];
    }
  }

  async getEpisodes(animeUrl: string, lang: 'vf' | 'vostfr' = 'vostfr'): Promise<AnimeEpisode[]> {
    try {
      const response = await fetch(`${this.info.baseUrl}/api/anime/${animeUrl}`);
      const data = await response.json();
      const content = data.result;
      
      if (!content) return [];

      const episodes: AnimeEpisode[] = [];

      if (content.seasons && content.seasons.length > 0) {
        // Collect all episodes across seasons
        for (const season of content.seasons) {
          if (season.episodes && season.episodes.length > 0) {
            for (const ep of season.episodes) {
              // Filter by lang if needed.
              // Arkanime videoType can be 'multi', 'vostfr_only', 'vf_only'.
              if (lang === 'vf' && ep.videoType === 'vostfr_only') continue;
              if (lang === 'vostfr' && ep.videoType === 'vf_only') continue;
              
              episodes.push({
                title: `Episode ${ep.number}`,
                number: ep.number,
                url: `montmyoboky:${ep.id}`, // Custom format to resolve later
              });
            }
          }
        }
      } else if (content.movie) {
        episodes.push({
          title: 'Film',
          number: 1,
          url: `montmyoboky_movie:${content.movie.id}`,
        });
      }

      return episodes;
    } catch (e) {
      console.error('Arkanime getEpisodes error:', e);
      return [];
    }
  }

  async resolveVideo(episodeUrl: string): Promise<VideoSource[]> {
    // This is handled natively in the Next.js API route because we need custom headers.
    // However, we provide a placeholder to satisfy the interface.
    // In a pure Node environment, we would implement the montmyoboky fetch here.
    return [];
  }
}
