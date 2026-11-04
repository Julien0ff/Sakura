import * as cheerio from 'cheerio';
import { VideoSource } from '../types';

export interface Extractor {
  name: string;
  canExtract(url: string): boolean;
  extract(url: string): Promise<VideoSource[]>;
}

export class UqloadExtractor implements Extractor {
  name = 'Uqload';

  canExtract(url: string): boolean {
    return url.includes('uqload');
  }

  async extract(url: string): Promise<VideoSource[]> {
    const response = await fetch(url);
    const html = await response.text();
    
    // Uqload usually hides the video URL in a script tag like:
    // sources: ["https://....mp4"],
    const sourcesMatch = html.match(/sources:\s*\["([^"]+)"\]/);
    if (sourcesMatch && sourcesMatch[1]) {
      return [{
        url: sourcesMatch[1],
        quality: 'Auto',
        type: 'mp4'
      }];
    }
    
    return [];
  }
}

export class SendvidExtractor implements Extractor {
  name = 'Sendvid';

  canExtract(url: string): boolean {
    return url.includes('sendvid');
  }

  async extract(url: string): Promise<VideoSource[]> {
    const response = await fetch(url);
    const html = await response.text();
    
    // Sendvid typically uses a video tag with a source, or a meta property
    const $ = cheerio.load(html);
    const src = $('source#video_source').attr('src') || $('meta[property="og:video"]').attr('content');
    
    if (src) {
      return [{
        url: src,
        quality: 'Auto',
        type: src.includes('.m3u8') ? 'hls' : 'mp4'
      }];
    }
    
    // Fallback regex if it's hidden in scripts
    const videoMatch = html.match(/video_source\s*=\s*['"]([^'"]+)['"]/);
    if (videoMatch && videoMatch[1]) {
      return [{
        url: videoMatch[1],
        quality: 'Auto',
        type: videoMatch[1].includes('.m3u8') ? 'hls' : 'mp4'
      }];
    }

    return [];
  }
}

// Registry
const extractors: Extractor[] = [
  new UqloadExtractor(),
  new SendvidExtractor()
];

export async function resolveIframe(url: string): Promise<VideoSource[]> {
  for (const extractor of extractors) {
    if (extractor.canExtract(url)) {
      try {
        return await extractor.extract(url);
      } catch (e) {
        console.error(`Failed to extract from ${extractor.name}`, e);
      }
    }
  }
  // Si on n'a pas d'extracteur, on renvoie l'iframe brute en dernier recours
  return [{
    url: url,
    quality: 'Iframe (Fallback)',
    type: 'iframe' as any // Using as any since 'iframe' might not be in the VideoSource type definition yet
  }];
}
