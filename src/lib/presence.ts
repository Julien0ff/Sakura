/**
 * Discord Rich Presence activity (desktop app). Pure module so `node --test` can load it;
 * the Rust side (src-tauri/src/presence.rs) sanitizes again and talks to Discord.
 */

export interface PresenceInput {
  animeId: number;
  title: string;
  cover: string | null;
  season: number;
  multiSeason: boolean;
  episode: number;
  lang: 'vf' | 'vostfr';
  playing: boolean;
  /** Seconds into the episode. */
  time: number;
  /** Episode length in seconds; 0 when unknown (embedded players). */
  duration: number;
  /** Epoch ms (injected for tests). */
  now: number;
  /** Site origin, for the logo and the button link. */
  origin: string;
}

/** snake_case: deserialized as-is by Rust. Timestamps in epoch seconds. */
export interface PresencePayload {
  details: string;
  state: string;
  large_image: string | null;
  large_text: string;
  small_image: string;
  small_text: string;
  start?: number;
  end?: number;
  button_label: string;
  button_url: string;
}

/** Discord rejects text fields shorter than 2 or longer than 128 characters. */
export function fitField(s: string): string {
  const t = [...s.trim()];
  const cut = t.length > 128 ? t.slice(0, 127).join('') + '…' : t.join('');
  return cut.length < 2 ? cut.padEnd(2, ' ') : cut;
}

export function buildPresence(i: PresenceInput): PresencePayload {
  const parts = [i.multiSeason ? `Saison ${i.season}` : null, `Épisode ${i.episode}`, i.lang === 'vf' ? 'VF' : 'VOSTFR'].filter(Boolean);
  const where = parts.join(' · ');
  const out: PresencePayload = {
    details: fitField(i.title),
    state: fitField(i.playing ? where : `En pause · ${where}`),
    large_image: i.cover,
    large_text: fitField(i.title),
    small_image: `${i.origin}/icon.png`,
    small_text: 'SAKURA',
    button_label: 'Regarder sur SAKURA',
    button_url: `${i.origin}/anime?id=${i.animeId}`,
  };
  if (i.playing && i.duration > 0) {
    const start = Math.floor(i.now / 1000 - i.time);
    out.start = start;
    out.end = Math.floor(start + i.duration);
  }
  return out;
}
