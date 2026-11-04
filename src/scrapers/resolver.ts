import { AnimeScraper, VideoSource, AnimeEpisode } from './types';
import { AnimeSamaScraper } from './animesama';
import { VostfreeScraper } from './vostfree';
import { ArkanimeScraper } from './arkanime';

const scrapers: AnimeScraper[] = [
  new AnimeSamaScraper(),
  new VostfreeScraper(),
  new ArkanimeScraper()
];

export function getScrapers() {
  return scrapers;
}

export function getScraperByName(name: string): AnimeScraper | undefined {
  return scrapers.find(s => s.info.name.toLowerCase() === name.toLowerCase());
}

export async function searchAnime(query: string) {
  // Option 1: Search all scrapers concurrently
  const promises = scrapers.map(scraper => scraper.search(query).then(results => ({
    scraper: scraper.info.name,
    results
  })).catch(e => {
    console.error(`Error searching ${scraper.info.name}`, e);
    return { scraper: scraper.info.name, results: [] };
  }));
  
  return Promise.all(promises);
}

export async function resolveVideoUrl(episodeUrl: string, scraperName: string): Promise<VideoSource[]> {
  const scraper = getScraperByName(scraperName);
  if (!scraper) {
    throw new Error(`Scraper ${scraperName} not found`);
  }
  return scraper.resolveVideo(episodeUrl);
}

export async function getEpisodes(animeUrl: string, scraperName: string): Promise<AnimeEpisode[]> {
  const scraper = getScraperByName(scraperName);
  if (!scraper) {
    throw new Error(`Scraper ${scraperName} not found`);
  }
  return scraper.getEpisodes(animeUrl);
}
