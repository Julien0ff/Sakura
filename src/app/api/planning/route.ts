import { NextResponse } from 'next/server';
import { parsePlanning } from '@/lib/planning';

// Weekly VF / VOSTFR release planning (French times), parsed server-side from Anime-Sama.
const SOURCE = 'https://anime-sama.to/planning/';

export async function GET() {
  try {
    const res = await fetch(SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SAKURA)', Accept: 'text/html' },
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) throw new Error(`planning ${res.status}`);
    const entries = parsePlanning(await res.text());
    return NextResponse.json(entries, {
      headers: { 'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Planning indisponible' }, { status: 502 });
  }
}
