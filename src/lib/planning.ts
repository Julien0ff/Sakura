/**
 * Anime-Sama weekly planning (French release times, VF and VOSTFR).
 * Pure module (no imports) so `node --test` can load it.
 *
 * Page shape: 7 day sections `<div id="0..6" class="selectedRow …"><h2>Lundi</h2><p>02/11</p>…`,
 * each holding cards `<div class="… planning-card Anime VF pl-sorti" data-nom="…" data-lien="…">`
 * with the time in `<span class="as-carte-temps">18h05</span>` (Paris time, `?` when unknown).
 */

export type PlanningLang = 'vf' | 'vostfr';

export interface PlanningEntry {
  title: string;
  lang: PlanningLang;
  /** Release day, YYYY-MM-DD (Paris calendar). */
  date: string;
  /** HH:MM, Paris time; null when not announced. */
  time: string | null;
  /** « Saison 2 », « Partie 4 »… (Anime-Sama has no episode numbers in the planning). */
  label: string | null;
  /** Catalogue slug, e.g. `blue-box`. */
  slug: string;
  /** Postponed releases are kept but flagged. */
  postponed: boolean;
  /** Anime-Sama artwork (fallback when the title can't be matched on AniList). */
  image: string | null;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&#039;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'" };
const decode = (s: string) => s.replace(/&(amp|#039|quot|lt|gt|apos);/g, (m) => ENTITIES[m] ?? m).trim();

/** Picks the year that puts dd/mm closest to `now` (handles the December → January week). */
export function inferDate(dayMonth: string, now: Date): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(dayMonth.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = now.getUTCFullYear();
  const best = [y - 1, y, y + 1]
    .map((year) => ({ year, diff: Math.abs(Date.UTC(year, mo - 1, d) - now.getTime()) }))
    .sort((a, b) => a.diff - b.diff)[0].year;
  return `${best}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function langOf(classes: string, lien: string): PlanningLang | null {
  const words = classes.split(/\s+/);
  if (words.includes('VF')) return 'vf';
  if (words.includes('VOSTFR')) return 'vostfr';
  if (/\/vf\/?$/.test(lien)) return 'vf';
  if (/\/vostfr\/?$/.test(lien)) return 'vostfr';
  return null;
}

export function parsePlanning(html: string, now = new Date()): PlanningEntry[] {
  const out: PlanningEntry[] = [];
  const sections = [...html.matchAll(/<div id="(\d)" class="selectedRow[^"]*">\s*<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([^<]*)<\/p>/g)];
  sections.forEach((sec, i) => {
    const date = inferDate(sec[2], now);
    if (!date) return;
    const end = i + 1 < sections.length ? sections[i + 1].index! : html.length;
    const body = html.slice(sec.index!, end);
    for (const card of body.matchAll(/<div class="([^"]*planning-card Anime[^"]*)"([^>]*)>([\s\S]*?)as-carte-temps">([^<]*)</g)) {
      const [, classes, attrs, inner, rawTime] = card;
      const data = Object.fromEntries([...attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
      const lien = data.lien ?? '';
      const lang = langOf(classes, lien);
      const slug = /\/catalogue\/([^/]+)\//.exec(data.url ?? lien)?.[1];
      if (!lang || !slug || !data.nom) continue;
      const t = /^(\d{1,2})h(\d{2})$/.exec(rawTime.trim());
      const label = /as-carte-info">[\s\S]*?<span>([^<]*)<\/span>/.exec(inner)?.[1];
      out.push({
        title: decode(data.nom),
        lang,
        date,
        time: t ? `${t[1].padStart(2, '0')}:${t[2]}` : null,
        label: label ? decode(label) : null,
        slug,
        postponed: /\bpl-reporte\b/.test(classes),
        image: data.img?.startsWith('https://') ? data.img : null,
      });
    }
  });
  return out;
}

/** Epoch seconds for a Paris wall-clock time (DST-aware). */
export function parisToEpoch(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms: number) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' })
      .formatToParts(new Date(ms))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00';
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) * 60_000 : 3_600_000;
  };
  // Two passes settle DST edges.
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts);
  return Math.floor(ts / 1000);
}
