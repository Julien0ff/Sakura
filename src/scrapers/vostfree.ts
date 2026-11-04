import * as cheerio from 'cheerio';
import { AnimeScraper, AnimeEpisode, ScraperInfo, VideoSource } from './types';

export class VostfreeScraper implements AnimeScraper {
  info: ScraperInfo = {
    name: 'Vostfree',
    baseUrl: 'https://ipv4.vostfree.ws', // Les domaines changent souvent (.tv, .ws, .com)
    lang: ['fr', 'vostfr'],
  };

  async search(query: string) {
    const url = `${this.info.baseUrl}/index.php?do=search`;
    
    const formData = new URLSearchParams();
    formData.append('do', 'search');
    formData.append('subaction', 'search');
    formData.append('search_start', '0');
    formData.append('full_search', '0');
    formData.append('result_from', '1');
    formData.append('story', query);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: { title: string; url: string; poster?: string }[] = [];

    $('.search-result').each((_, el) => {
      // Structure HTML de vostfree peut varier
      const a = $(el).find('.title a').first();
      const title = a.text().trim();
      const href = a.attr('href');
      const poster = $(el).find('.image img').attr('src');
      
      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${this.info.baseUrl}${href}`,
          poster: poster?.startsWith('http') ? poster : `${this.info.baseUrl}${poster}`
        });
      }
    });

    return results;
  }

  async getEpisodes(animeUrl: string, lang?: 'vf' | 'vostfr'): Promise<AnimeEpisode[]> {
    const response = await fetch(animeUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const episodes: AnimeEpisode[] = [];
    
    // Vostfree utilise souvent une div select ou une liste pour les épisodes
    $('select.new_player_selector option').each((_, el) => {
      const epNum = $(el).text().match(/\d+/);
      const urlPart = $(el).attr('value'); // Souvent c'est un lien vers la page de l'épisode
      
      if (epNum && urlPart) {
        episodes.push({
          number: parseInt(epNum[0], 10),
          url: `${animeUrl}#${urlPart}`,
        });
      }
    });

    return episodes;
  }

  async resolveVideo(episodeUrl: string): Promise<VideoSource[]> {
    const [pageUrl, buttonId] = episodeUrl.split('#');
    
    const response = await fetch(pageUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let sources: VideoSource[] = [];
    const iframeUrls: string[] = [];
    
    if (buttonId) {
      $(`div#${buttonId} div[id^=player_]`).each((_, el) => {
        const playerId = $(el).attr('id');
        const providerClass = $(el).attr('class') || '';
        const contentStr = $(`div#content_${playerId}`).text().trim();
        
        if (!contentStr) return;
        
        // Skip sibnet as it is dead/blocks embeds (403 Forbidden)
        if (providerClass.includes('sibnet')) {
          return;
        }
        
        if (providerClass.includes('uqload')) {
          iframeUrls.push(`https://uqload.co/embed-${contentStr}.html`);
        } else if (contentStr.startsWith('http')) {
          iframeUrls.push(contentStr);
        }
      });
    } else {
      // Extract iframe URLs
      $('.new_player_top iframe, #lecteur iframe').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          iframeUrls.push(src.startsWith('//') ? `https:${src}` : src);
        }
      });
    }

    // Import dynamique pour éviter les dépendances circulaires
    const { resolveIframe } = await import('./extractors');
    
    for (const iframeUrl of iframeUrls) {
      const extracted = await resolveIframe(iframeUrl);
      if (extracted.length > 0) {
        sources = [...sources, ...extracted];
      }
    }

    // Direct extraction failed (hosts change often): fall back to the embed players
    // so the user can still watch through the iframe player.
    if (sources.length === 0) {
      sources = iframeUrls.map((url) => ({ url, quality: 'Auto', type: 'iframe' as const }));
    }

    return sources;
  }
}
