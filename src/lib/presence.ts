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
  /** Embedded players report no time: episode length in seconds (TMDB / AniList)… */
  estimatedLength?: number;
  /** …counted from when the player opened (epoch ms). */
  openedAt?: number;
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
  /** Member-list status: `details` = « Regarde <anime> », `name` = « Regarde SAKURA ». */
  display: 'details' | 'name';
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
    display: 'details',
  };
  if (i.playing && i.duration > 0) {
    const start = Math.floor(i.now / 1000 - i.time);
    out.start = start;
    out.end = Math.floor(start + i.duration);
  } else if (i.playing && i.estimatedLength && i.openedAt) {
    // Start + end make Discord draw a progress bar (like music apps), even for embedded players.
    const start = Math.floor(i.openedAt / 1000);
    out.start = start;
    out.end = start + Math.floor(i.estimatedLength);
  }
  return out;
}

/** Pages outside the player: [details, state]. Longest matching prefix wins. */
const PAGES: [string, string, string][] = [
  ['/', 'Accueil', 'Parcourt le catalogue'],
  ['/search', 'Recherche', 'Cherche un anime'],
  ['/discover', 'Découvrir', 'Explore les genres'],
  ['/calendar', 'Calendrier', 'Consulte les prochaines sorties'],
  ['/watchlist', 'Ma liste', 'Parcourt sa liste'],
  ['/history', 'Historique', 'Revoit son historique'],
  ['/settings', 'Paramètres', 'Règle son SAKURA'],
  ['/anime', 'Fiche d’un anime', 'Consulte la fiche'],
  ['/app', 'Application', 'Découvre l’application'],
  ['/onboarding', 'Bienvenue', 'Crée son profil'],
];
/** Top-level routes that are not profiles (`/<username>`). */
const NOT_PROFILES = new Set(['legal', 'auth', 'api']);

export interface BrowsingInput {
  path: string;
  /** Epoch ms when the app session started; 0 = unknown (no time shown). */
  since: number;
  origin: string;
  /** On an anime page: show that anime. */
  anime?: { id: number; title: string; cover: string | null };
}

export function buildBrowsingPresence(i: BrowsingInput): PresencePayload {
  const exact = PAGES.find(([p]) => p === i.path);
  const prefix = PAGES.filter(([p]) => p !== '/' && i.path.startsWith(p + '/')).sort((a, b) => b[0].length - a[0].length)[0];
  const top = i.path.split('/')[1] ?? '';
  const isProfile = !exact && !prefix && top !== '' && !top.includes('.') && !NOT_PROFILES.has(top) && i.path.split('/').length === 2;
  let [details, state] = exact ? [exact[1], exact[2]] : prefix ? [prefix[1], prefix[2]] : isProfile ? ['Profils', 'Regarde un profil'] : ['Sur SAKURA', 'Parcourt le site'];
  if (i.anime) [details, state] = [i.anime.title, 'Consulte la fiche'];

  const out: PresencePayload = {
    details: fitField(details),
    state: fitField(state),
    large_image: i.anime?.cover ?? `${i.origin}/icon.png`,
    large_text: fitField(i.anime?.title ?? 'SAKURA'),
    small_image: `${i.origin}/icon.png`,
    small_text: 'SAKURA',
    button_label: i.anime ? 'Voir sur SAKURA' : 'Découvrir SAKURA',
    button_url: i.anime ? `${i.origin}/anime?id=${i.anime.id}` : i.origin,
    display: 'name',
  };
  if (i.since > 0) out.start = Math.floor(i.since / 1000);
  return out;
}

/** What Discord shows: the player when something plays, else the current page. */
export function pickPresence(page: PresencePayload | null, playback: PresencePayload | null): PresencePayload | null {
  return playback ?? page;
}

/** A new time bar is only worth sending when it moved by more than this (a seek, not a tick). */
const DRIFT_S = 10;

/** Same activity for Discord's purposes (avoids resending on every progress report). */
export function samePresence(a: PresencePayload | null, b: PresencePayload | null): boolean {
  if (!a || !b) return a === b;
  const { start: sa, end: ea, ...ra } = a;
  const { start: sb, end: eb, ...rb } = b;
  if (JSON.stringify(ra) !== JSON.stringify(rb)) return false;
  if ((sa === undefined) !== (sb === undefined) || (ea === undefined) !== (eb === undefined)) return false;
  return Math.abs((sa ?? 0) - (sb ?? 0)) <= DRIFT_S;
}
