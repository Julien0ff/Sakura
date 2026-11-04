import * as cheerio from 'cheerio';
import { AnimeScraper, AnimeEpisode, ScraperInfo, VideoSource } from './types';

export class AnimeSamaScraper implements AnimeScraper {
  info: ScraperInfo = {
    name: 'Anime-Sama',
    baseUrl: 'https://anime-sama.to',
    lang: ['fr', 'vostfr'],
  };

  async search(query: string) {
    const url = `${this.info.baseUrl}/catalogue/?search=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const results: { title: string; url: string; poster?: string }[] = [];
    $('.catalog-card').each((_, el) => {
      const a = $(el).find('a').first();
      const title = $(el).find('.card-title').text().trim();
      const altTitles = $(el).find('.alternate-titles').text().trim();
      const href = a.attr('href');
      const poster = $(el).find('img').attr('src');
      
      if (title && href) {
        results.push({
          title: altTitles ? `${title} (${altTitles})` : title,
          url: href,
          poster
        });
      }
    });

    return results;
  }

  async getEpisodes(animeUrl: string, lang: 'vf' | 'vostfr' = 'vostfr'): Promise<AnimeEpisode[]> {
    const response = await fetch(animeUrl);
    const html = await response.text();
    
    // Anime-Sama uses `panneauAnime("Saison 1", "saison1/vostfr");`
    let episodesPath = '';
    
    if (lang === 'vf') {
      const matchVf = html.match(/panneauAnime\([^,]+,\s*"([^"]+vf[^"]*)"\)/i);
      if (matchVf && matchVf[1]) {
        episodesPath = matchVf[1];
      }
    } else {
      const match = html.match(/panneauAnime\([^,]+,\s*"([^"]+vostfr[^"]*)"\)/i);
      if (match && match[1]) {
        episodesPath = match[1];
      }
    }

    if (!episodesPath) return [];
    
    let epsJsUrl = '';
    if (episodesPath) {
      epsJsUrl = `${animeUrl}/${episodesPath}/episodes.js`.replace(/([^:])\/\//g, '$1/');
    } else {
      epsJsUrl = `${animeUrl}/episodes.js`.replace(/([^:])\/\//g, '$1/');
    }

    const epsResponse = await fetch(epsJsUrl);
    if (!epsResponse.ok) return [];
    
    const epsJs = await epsResponse.text();
    
    // parse var eps1, eps2, etc.
    const extractEps = (matchVar: string) => {
      const match = epsJs.match(new RegExp(`var\\s+${matchVar}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
      if (!match || !match[1]) return [];
      return match[1].split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(s => s.startsWith('http'));
    };

    const eps1 = extractEps('eps1');
    const eps2 = extractEps('eps2');
    const eps3 = extractEps('eps3');
    const eps4 = extractEps('eps4');
    const eps5 = extractEps('eps5');
    
    const episodes: AnimeEpisode[] = [];
    const maxEps = Math.max(eps1.length, eps2.length, eps3.length, eps4.length, eps5.length);
    
    for (let i = 0; i < maxEps; i++) {
      const players = [];
      if (eps1[i]) players.push(eps1[i]);
      if (eps2[i]) players.push(eps2[i]);
      if (eps3[i]) players.push(eps3[i]);
      if (eps4[i]) players.push(eps4[i]);
      if (eps5[i]) players.push(eps5[i]);
      
      if (players.length > 0) {
        episodes.push({
          number: i + 1,
          url: JSON.stringify(players),
          title: `Épisode ${i + 1}`
        });
      }
    }

    return episodes;
  }

  async resolveVideo(episodeUrl: string): Promise<VideoSource[]> {
    try {
      const urls: string[] = JSON.parse(episodeUrl);
      
      // Sort to prioritize stable players
      const scoreUrl = (url: string) => {
        if (url.includes('vk.')) return 10;
        if (url.includes('ansembed')) return 9;
        if (url.includes('sendvid')) return 8;
        if (url.includes('sibnet')) return 1; // Often blocks
        if (url.includes('oneupload')) return 2; // Often missing backfil
        if (url.includes('lpayer')) return 3; // Often 502 bad gateway
        return 5;
      };

      const sortedUrls = [...urls].sort((a, b) => scoreUrl(b) - scoreUrl(a));

      // Resolve direct links for known players (to avoid iframe ads)
      const resolvedSources: VideoSource[] = [];
      
      for (const u of sortedUrls) {
        let name = 'Lecteur';
        if (u.includes('vk.')) name = 'VK';
        else if (u.includes('ansembed')) name = 'Ansembed';
        else if (u.includes('sendvid')) name = 'Sendvid';
        else if (u.includes('sibnet')) name = 'Sibnet';
        else if (u.includes('oneupload')) name = 'Oneupload';
        else if (u.includes('lpayer')) name = 'Lpayer';
        
        let finalUrl = u;
        let type: 'iframe' | 'hls' | 'mp4' = 'iframe';
        
        // Attempt to extract direct HLS link from ansembed
        if (u.includes('ansembed')) {
          try {
            const res = await fetch(u, {
              headers: {
                'Referer': 'https://anime-sama.to/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
              }
            });
            const html = await res.text();
            const sourceMatch = html.match(/sources:\s*\[\{\s*file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
            if (sourceMatch && sourceMatch[1]) {
              finalUrl = sourceMatch[1];
              type = 'hls';
            }
          } catch (e) {
            console.warn('Failed to extract ansembed direct link', e);
          }
        }
        
        resolvedSources.push({
          url: finalUrl,
          quality: name,
          type
        });
      }

      return resolvedSources;
    } catch {
      return [
        {
          url: episodeUrl,
          quality: 'Auto',
          type: 'iframe'
        }
      ];
    }
  }
}
