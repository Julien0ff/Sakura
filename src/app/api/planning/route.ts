import { NextResponse } from 'next/server';
import { ANILIST_API_URL } from '@/core/api/anilist';
import { buildResolveQuery, parisToEpoch, parsePlanning, readResolved, type PlanningItem, type ResolvedMedia } from '@/lib/planning';

// Weekly VF / VOSTFR release planning (French times), parsed server-side from Anime-Sama and matched
// to AniList here, so the calendar and the desktop app's notifications get AniList ids directly.
const SOURCE = 'https://anime-sama.to/planning/';

/** AniList caps query complexity at 500 (~13 per aliased search): batches of 25. */
const BATCH = 25;

async function resolve(titles: string[]): Promise<Map<string, ResolvedMedia>> {
  const out = new Map<string, ResolvedMedia>();
  for (let i = 0; i < titles.length; i += BATCH) {
    for (const [k, v] of await resolveBatch(titles.slice(i, i + BATCH))) out.set(k, v);
  }
  return out;
}

async function resolveBatch(titles: string[]): Promise<Map<string, ResolvedMedia>> {
  if (titles.length === 0) return new Map();
  const { query, variables } = buildResolveQuery(titles);
  const res = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  // Partial results are fine: one unknown title must not hide the others.
  const json = await res.json().catch(() => null);
  return readResolved(titles, json?.data ?? null);
}

export async function GET() {
  try {
    const res = await fetch(SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SAKURA)', Accept: 'text/html' },
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) throw new Error(`planning ${res.status}`);
    const entries = parsePlanning(await res.text());
    // Only French dubs need matching: VOSTFR releases come from AniList's own airing schedule.
    const media = await resolve([...new Set(entries.filter((e) => e.lang === 'vf').map((e) => e.title))]).catch(() => new Map<string, ResolvedMedia>());
    const items: PlanningItem[] = entries.map((e) => ({
      ...e,
      airingAt: parisToEpoch(e.date, e.time ?? '23:59'),
      anilist: e.lang === 'vf' ? (media.get(e.title) ?? null) : null,
    }));
    return NextResponse.json(items, {
      headers: { 'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Planning indisponible' }, { status: 502 });
  }
}
