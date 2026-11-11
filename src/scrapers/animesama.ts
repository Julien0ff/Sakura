import * as cheerio from 'cheerio';
import { AnimeScraper, AnimeEpisode, ScraperInfo, VideoSource } from './types';

export class AnimeSamaScraper implements AnimeScraper {
  info: ScraperInfo = {
    name: 'Anime-Sama',
    baseUrl: 'https://anime-sama.to',
    lang: ['fr', 'vostfr'],
  };

  private getHeaders(referer?: string) {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer || `${this.info.baseUrl}/catalogue/`,
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    };
  }

  async search(query: string) {
    try {
      const url = `${this.info.baseUrl}/catalogue/fragment.php?search=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: this.getHeaders() });
      const data = await response.json();
      
      if (!data || !data.liste) return [];

      const $ = cheerio.load(data.liste);
      const results: { title: string; url: string; poster?: string }[] = [];

      $('.as-carte, .catalog-card').each((_, el) => {
        const a = $(el).find('a').first();
        const title = $(el).attr('data-nom') || $(el).find('.as-carte-titre, .card-title').text().trim();
        let href = $(el).attr('data-url') || a.attr('href');
        const poster = $(el).attr('data-img') || $(el).find('img').attr('src');
        
        if (title && href) {
          if (!href.startsWith('http')) {
            href = `${this.info.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
          }
          results.push({
            title: title.trim(),
            url: href,
            poster
          });
        }
      });

      return results;
    } catch (e) {
      console.error('AnimeSama search error:', e);
      return [];
    }
  }

  async getEpisodes(animeUrl: string, lang: 'vf' | 'vostfr' = 'vostfr', season?: number): Promise<AnimeEpisode[]> {
    try {
      const response = await fetch(animeUrl, { headers: this.getHeaders(animeUrl) });
      const html = await response.text();

      // Extract all panneauAnime calls: panneauAnime("Saison 1", "saison1/vf")
      const panels: { label: string; path: string }[] = [];
      const panelRegex = /panneauAnime\(\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*\)/g;
      let pMatch;
      while ((pMatch = panelRegex.exec(html)) !== null) {
        const label = pMatch[1].trim();
        const path = pMatch[2].trim();
        if (path && path !== 'url' && !path.includes('nom') && !path.startsWith('http')) {
          panels.push({ label, path });
        }
      }

      let episodesPath = '';

      if (panels.length > 0) {
        const targetLang = lang === 'vf' ? 'vf' : 'vostfr';
        const otherLang = targetLang === 'vf' ? 'vostfr' : 'vf';

        const matchSeason = (p: { label: string; path: string }, sNum: number) => {
          const l = p.label.toLowerCase();
          const path = p.path.toLowerCase();
          const sStr = String(sNum);
          const sPad = sNum < 10 ? `0${sNum}` : sStr;
          return (
            path.includes(`saison${sStr}`) ||
            path.includes(`saison${sPad}`) ||
            path.includes(`saison_${sStr}`) ||
            path.includes(`s${sStr}`) ||
            l.includes(`saison ${sStr}`) ||
            l.includes(`saison ${sPad}`)
          );
        };

        if (season) {
          // 1. Try matching season AND requested language
          const best = panels.find((p) => matchSeason(p, season) && p.path.toLowerCase().includes(targetLang));
          if (best) {
            episodesPath = best.path;
          } else {
            // 2. Try matching season with other language (cartoons often only have VF)
            const fallbackSeason = panels.find((p) => matchSeason(p, season));
            if (fallbackSeason) episodesPath = fallbackSeason.path;
          }
        }

        if (!episodesPath) {
          // 3. Try requested language in any panel
          const byLang = panels.find((p) => p.path.toLowerCase().includes(targetLang));
          if (byLang) {
            episodesPath = byLang.path;
          } else {
            // 4. Try other language
            const byOtherLang = panels.find((p) => p.path.toLowerCase().includes(otherLang));
            if (byOtherLang) {
              episodesPath = byOtherLang.path;
            } else if (panels.length > 0) {
              episodesPath = panels[0].path;
            }
          }
        }
      }

      if (!episodesPath) return [];

      let epsJsUrl = `${animeUrl}/${episodesPath}/episodes.js`.replace(/([^:])\/\//g, '$1/');

      const epsResponse = await fetch(epsJsUrl, { headers: this.getHeaders(animeUrl) });
      if (!epsResponse.ok) {
        // Fallback to direct episodes.js
        epsJsUrl = `${animeUrl}/episodes.js`.replace(/([^:])\/\//g, '$1/');
        const fallbackRes = await fetch(epsJsUrl, { headers: this.getHeaders(animeUrl) });
        if (!fallbackRes.ok) return [];
      }

      const epsJs = await (epsResponse.ok ? epsResponse.text() : '');
      if (!epsJs) return [];

      // parse var eps1, eps2, etc.
      const extractEps = (matchVar: string) => {
        const match = epsJs.match(new RegExp(`var\\s+${matchVar}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
        if (!match || !match[1]) return [];
        return match[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter((s) => s.startsWith('http'));
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
            title: `Épisode ${i + 1}`,
          });
        }
      }

      return episodes;
    } catch (e) {
      console.error('AnimeSama getEpisodes error:', e);
      return [];
    }
  }

  async resolveVideo(episodeUrl: string): Promise<VideoSource[]> {
    try {
      const urls: string[] = JSON.parse(episodeUrl);

      // Sort to prioritize stable and responsive players
      const scoreUrl = (url: string) => {
        if (url.includes('vk.')) return 10;
        if (url.includes('ansembed')) return 9;
        if (url.includes('sendvid')) return 8;
        if (url.includes('uqload')) return 7;
        if (url.includes('susanexpectcare') || url.includes('streamwish')) return 6;
        if (url.includes('oneupload')) return 4;
        if (url.includes('lpayer')) return 3;
        if (url.includes('sibnet')) return 2;
        return 5;
      };

      const sortedUrls = [...urls].sort((a, b) => scoreUrl(b) - scoreUrl(a));

      const resolvedSources: VideoSource[] = [];

      for (const u of sortedUrls) {
        let name = 'Lecteur';
        if (u.includes('vk.')) name = 'VK';
        else if (u.includes('ansembed')) name = 'Ansembed';
        else if (u.includes('sendvid')) name = 'Sendvid';
        else if (u.includes('uqload')) name = 'Uqload';
        else if (u.includes('susanexpectcare') || u.includes('streamwish')) name = 'Streamwish';
        else if (u.includes('sibnet')) name = 'Sibnet';
        else if (u.includes('oneupload')) name = 'Oneupload';
        else if (u.includes('lpayer')) name = 'Lpayer';

        // Attempt to extract direct HLS link from ansembed
        if (u.includes('ansembed')) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(u, {
              headers: {
                Referer: 'https://anime-sama.to/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const html = await res.text();
            const sourceMatch = html.match(/sources:\s*\[\{\s*file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
            if (sourceMatch && sourceMatch[1]) {
              resolvedSources.push({
                url: sourceMatch[1],
                quality: `${name} (Direct)`,
                type: 'hls',
              });
            }
          } catch (e) {
            console.warn('Failed to extract ansembed direct link', e);
          }
        }

        // Always keep the embed URL as a reliable playback source
        resolvedSources.push({
          url: u,
          quality: name,
          type: 'iframe',
        });
      }

      return resolvedSources.length > 0
        ? resolvedSources
        : [
            {
              url: episodeUrl,
              quality: 'Auto',
              type: 'iframe',
            },
          ];
    } catch {
      return [
        {
          url: episodeUrl,
          quality: 'Auto',
          type: 'iframe',
        },
      ];
    }
  }
}
