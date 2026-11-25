/**
 * Ad-free playback for Anime-Sama's main player (ansembed, a vidmoly white label): its embed page
 * carries the HLS playlist in clear (`sources: [{ file: '…master.m3u8?…' }]`). Played in our own
 * player, no third-party iframe means no pop-ups, redirects or « Download » ad button.
 *
 * It must run on the viewer's device: the playlist's token is bound to the IP that loaded the page
 * (segments answer 403 elsewhere), so the server can't do it. The host allows CORS from any origin.
 * Pure module (no imports) so `node --test` can load it.
 */

type Source = { url: string; type: 'hls' | 'mp4' | 'youtube' | 'iframe'; quality?: string };

const HOSTS = ['ansembed', 'vidmoly'];

export const hasDirectStream = (url: string) => HOSTS.some((h) => url.includes(h));

/** The HLS playlist of an ansembed/vidmoly embed page, or null. */
export function parseEmbedPlaylist(html: string): string | null {
  const m = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

async function fetchPlaylist(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), credentials: 'omit' });
    return res.ok ? parseEmbedPlaylist(await res.text()) : null;
  } catch {
    return null;
  }
}

/**
 * Puts the direct stream of each ansembed/vidmoly embed right before it. The embed stays in the
 * list as a fallback: if the stream fails, the player moves on to it.
 */
export async function withDirectStreams<T extends Source>(sources: T[], timeoutMs = 5000): Promise<T[]> {
  const streams = await Promise.all(
    sources.map((s) => (s.type === 'iframe' && hasDirectStream(s.url) ? fetchPlaylist(s.url, timeoutMs) : null))
  );
  return sources.flatMap((s, i) => {
    const stream = streams[i];
    if (!stream) return [s];
    return [{ ...s, url: stream, type: 'hls' as const, quality: `${s.quality ?? 'Lecteur'} · sans pub` }, s];
  });
}
