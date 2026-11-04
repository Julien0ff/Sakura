import { AnimeScraper, AnimeEpisode, ScraperInfo, VideoSource } from './types';

export class GogoanimeScraper implements AnimeScraper {
  info: ScraperInfo = {
    name: 'Gogoanime (English Fallback)',
    baseUrl: 'https://api.consumet.org/anime/gogoanime',
    lang: ['en'],
  };

  async search(query: string) {
    try {
      const res = await fetch(`${this.info.baseUrl}/${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (data && data.results) {
        return data.results.map((r: any) => ({
          title: r.title,
          url: r.id, // For consumet API, we just pass the ID as URL
          poster: r.image
        }));
      }
      return [];
    } catch (e) {
      console.error("Gogoanime search error", e);
      return [];
    }
  }

  async getEpisodes(animeUrl: string): Promise<AnimeEpisode[]> {
    try {
      // url is the anime id in consumet
      const res = await fetch(`${this.info.baseUrl}/info/${animeUrl}`);
      const data = await res.json();
      
      if (data && data.episodes) {
        return data.episodes.map((ep: any) => ({
          number: ep.number,
          url: ep.id,
          title: `Episode ${ep.number}`
        }));
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  async resolveVideo(episodeUrl: string): Promise<VideoSource[]> {
    try {
      const res = await fetch(`${this.info.baseUrl}/watch/${episodeUrl}`);
      const data = await res.json();
      
      if (data && data.sources) {
        return data.sources.map((s: any) => ({
          url: s.url,
          quality: s.quality || 'Auto',
          type: s.isM3U8 ? 'hls' : 'mp4'
        }));
      }
      return [];
    } catch (e) {
      return [];
    }
  }
}
