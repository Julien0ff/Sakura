import { NextResponse } from 'next/server';
import { latestRelease } from '@/lib/app-release-server';

// Update check of the mobile apps (Android: offers the new .apk). Same data as the « Application » page.
export async function GET() {
  const release = await latestRelease();
  if (!release) return NextResponse.json(null, { status: 503 });
  const first = (p: 'android' | 'ios') => release.downloads[p]?.[0]?.url ?? null;
  return NextResponse.json(
    { version: release.version, beta: release.beta, url: release.url, android: first('android'), ios: first('ios') },
    { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } },
  );
}
