import { NextResponse, type NextRequest } from 'next/server';

// Server-side proxy so the TMDB token never reaches the browser.
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Only the read endpoints the app uses.
const ALLOWED = [/^search\/(tv|movie)$/, /^tv\/\d+$/, /^tv\/\d+\/season\/\d+$/, /^movie\/\d+$/];

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TMDB_READ_TOKEN manquant dans .env.local' }, { status: 500 });
  }

  const path = (await params).path.join('/');
  if (!ALLOWED.some((re) => re.test(path))) {
    return NextResponse.json({ error: 'Endpoint non autorisé' }, { status: 404 });
  }

  const search = request.nextUrl.searchParams;
  search.delete('api_key');
  const res = await fetch(`${TMDB_BASE_URL}/${path}?${search}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    next: { revalidate: 60 * 60 * 6 },
  });

  return NextResponse.json(await res.json(), {
    status: res.status,
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
