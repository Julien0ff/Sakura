import * as cheerio from 'cheerio';
import { AnimeScraper, AnimeEpisode, ScraperInfo, VideoSource } from './types';

export class NekoSamaScraper implements AnimeScraper {
  info: ScraperInfo = {
    name: 'NekoSama',
    baseUrl: 'https://neko-sama.fr',
    lang: ['fr', 'vostfr'],
  };

  async search(query: string) {
    // NekoSama uses a full JSON list for search on the frontend, but we can also use their search page
    // Here we simulate the parsing
    const url = `${this.info.baseUrl}/anime/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const results: { title: string; url: string; poster?: string }[] = [];
    $('.anime').each((_, el) => {
      const a = $(el).find('a').first();
      const title = $(el).find('.title').text().trim();
      const href = a.attr('href');
      const poster = $(el).find('img').attr('src');
      
      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${this.info.baseUrl}${href}`,
          poster
        });
      }
    });

    return results;
  }

  async getEpisodes(animeUrl: string): Promise<AnimeEpisode[]> {
    const response = await fetch(animeUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const episodes: AnimeEpisode[] = [];
    // NekoSama lists episodes in a script tag as a JS array "var episodes = [...]"
    // We can extract it with regex
    const scriptMatch = html.match(/var\s+episodes\s*=\s*(\[[\s\S]*?\]);/);
    if (scriptMatch && scriptMatch[1]) {
      try {
        const epsData = JSON.parse(scriptMatch[1]);
        epsData.forEach((ep: any) => {
          episodes.push({
            number: parseInt(ep.num, 10),
            url: `${this.info.baseUrl}${ep.url}`,
            title: ep.title,
          });
        });
      } catch (e) {
        console.error('NekoSama: Error parsing episodes JSON', e);
      }
    }

    return episodes.reverse(); // Generally we want order 1, 2, 3...
  }

  async resolveVideo(episodeUrl: string): Promise<VideoSource[]> {
    const response = await fetch(episodeUrl);
    const html = await response.text();
    
    const sources: VideoSource[] = [];
    // NekoSama has a video variable: var video = [{url: "...", format: "1080p"}, ...]
    const videoMatch = html.match(/var\s+video\s*=\s*(\[[\s\S]*?\]);/);
    
    if (videoMatch && videoMatch[1]) {
      try {
        // Fix potential unquoted keys in JS object if any, but NekoSama usually provides valid JSON or near-valid
        // We'll use a regex replace to ensure keys are quoted just in case
        let jsonStr = videoMatch[1].replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
        // Replace single quotes with double quotes for string values
        jsonStr = jsonStr.replace(/'([^']*)'/g, '"$1"');
        
        const videoData = JSON.parse(jsonStr);
        videoData.forEach((vid: any) => {
          if (vid.url) {
            sources.push({
              url: vid.url,
              quality: vid.format || 'Auto',
              type: vid.url.includes('.m3u8') ? 'hls' : 'mp4'
            });
          }
        });
      } catch (e) {
        console.error('NekoSama: Error parsing video JSON', e);
        
        // Fallback: extract iframe URL if direct extraction fails
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (iframeMatch && iframeMatch[1]) {
          // You would then resolve the iframe, but we just return it here for the example
          console.log("Fallback to iframe:", iframeMatch[1]);
        }
      }
    }

    return sources;
  }
}
