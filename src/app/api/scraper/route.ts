import { NextResponse } from 'next/server';
import { VostfreeScraper } from '@/scrapers/vostfree';
import { AnimeSamaScraper } from '@/scrapers/animesama';
import { ArkanimeScraper } from '@/scrapers/arkanime';

const vostfree = new VostfreeScraper();
vostfree.info.baseUrl = 'https://ipv4.vostfree.ws';

const animesama = new AnimeSamaScraper();
const arkanime = new ArkanimeScraper();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const query = searchParams.get('query');
  const url = searchParams.get('url');
  const scraperParam = searchParams.get('scraper');

  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
  }

  try {
    if (action === 'search') {
      if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
      let results: any[] = [];
      
      // If scraper param is explicitly provided, only use that one
      if (scraperParam === 'vostfree') {
        try {
          results = await vostfree.search(query);
          results = results.map(r => ({ ...r, url: `vostfree:${r.url}` }));
        } catch (e) {}
      } else if (scraperParam === 'animesama') {
        try {
          const samaResults = await animesama.search(query);
          results = samaResults.map((r: any) => ({ ...r, url: `animesama:${r.url}` }));
        } catch (e) {}
      } else if (scraperParam === 'arkanime') {
        try {
          const arkResults = await arkanime.search(query);
          results = arkResults.map((r: any) => ({ ...r, url: `arkanime:${r.url}` }));
        } catch (e) {}
      } else {
        // Fallback chain: Vostfree -> Arkanime -> AnimeSama
        try {
          results = await vostfree.search(query);
          results = results.map(r => ({ ...r, url: `vostfree:${r.url}` }));
        } catch (e) {}
        
        if (results.length === 0) {
          try {
            const arkResults = await arkanime.search(query);
            results = arkResults.map((r: any) => ({ ...r, url: `arkanime:${r.url}` }));
          } catch (e) {}
        }

        if (results.length === 0) {
          try {
            const samaResults = await animesama.search(query);
            results = samaResults.map((r: any) => ({ ...r, url: `animesama:${r.url}` }));
          } catch (e) {}
        }
      }
      
      return NextResponse.json(results);
    }
    
    if (action === 'episodes') {
      if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });
      const lang = (searchParams.get('lang') || 'vostfr') as 'vf' | 'vostfr';
      
      let episodes: any[] = [];
      try {
        if (url.startsWith('vostfree:')) {
          episodes = await vostfree.getEpisodes(url.replace('vostfree:', ''), lang);
        } else if (url.startsWith('animesama:')) {
          episodes = await animesama.getEpisodes(url.replace('animesama:', ''), lang);
        } else if (url.startsWith('arkanime:')) {
          episodes = await arkanime.getEpisodes(url.replace('arkanime:', ''), lang);
        }
        
        // Re-prefix episode urls
        episodes = episodes.map(ep => ({
          ...ep,
          url: url.startsWith('vostfree:') ? `vostfree:${ep.url}` : 
               url.startsWith('animesama:') ? `animesama:${ep.url}` : 
               // Arkanime returns montmyoboky URLs natively
               ep.url.startsWith('montmyoboky') ? ep.url : `arkanime:${ep.url}`
        }));
      } catch (e) {
        console.warn('Scraper episodes failed', e);
      }
      
      return NextResponse.json(episodes);
    }
    
    if (action === 'resolve') {
      if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });
      let sources: any[] = [];
      try {
        if (url.startsWith('vostfree:')) {
          sources = await vostfree.resolveVideo(url.replace('vostfree:', ''));
        } else if (url.startsWith('animesama:')) {
          sources = await animesama.resolveVideo(url.replace('animesama:', ''));
        } else if (url.startsWith('montmyoboky:')) {
          // Arkanim (montmyoboky player)
          const epId = url.replace('montmyoboky:', '');
          const headers = {
            'Content-Type': 'application/json',
            'Referer': 'https://arkanim.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          };
          const res = await fetch(`https://arkanim.net/api/watch/token`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ episodeId: parseInt(epId) })
          });
          const { token } = await res.json();
          const resolveRes = await fetch(`https://arkanim.net/api/source/resolve?token=${token}`, { headers });
          const { videoUrl } = await resolveRes.json();
          sources = [{ url: videoUrl, type: 'hls' }];
        } else if (url.startsWith('montmyoboky_movie:')) {
          const movieId = url.replace('montmyoboky_movie:', '');
          const headers = {
            'Content-Type': 'application/json',
            'Referer': 'https://arkanim.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          };
          const res = await fetch(`https://arkanim.net/api/watch/movie-token`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ movieId: parseInt(movieId) })
          });
          const { token } = await res.json();
          const resolveRes = await fetch(`https://arkanim.net/api/source/resolve?token=${token}`, { headers });
          const { videoUrl } = await resolveRes.json();
          sources = [{ url: videoUrl, type: 'hls' }];
        }
      } catch (e) {
        console.warn('Scraper resolve failed', e);
      }
      
      return NextResponse.json(sources);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Scraper API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
