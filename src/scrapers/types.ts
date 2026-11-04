export interface VideoSource {
  url: string;
  quality: string;
  type: 'hls' | 'mp4' | 'iframe';
}

export interface AnimeEpisode {
  number: number;
  url: string;
  title?: string;
}

export interface ScraperInfo {
  name: string;
  baseUrl: string;
  lang: string[];
}

export interface AnimeScraper {
  info: ScraperInfo;
  
  /**
   * Search for an anime on the platform
   */
  search(query: string): Promise<{ title: string; url: string; poster?: string }[]>;
  
  /**
   * Get all episodes for a specific anime URL
   */
  getEpisodes(animeUrl: string, lang?: 'vf' | 'vostfr'): Promise<AnimeEpisode[]>;
  
  /**
   * Resolve an episode URL to direct video streams (.m3u8, .mp4)
   */
  resolveVideo(episodeUrl: string): Promise<VideoSource[]>;
}
