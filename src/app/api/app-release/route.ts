import { NextResponse } from 'next/server';
import { latestRelease } from '@/lib/app-release-server';

// Refreshed every 2 min even when GitHub didn't answer at build time (latestRelease has a deadline).
export const revalidate = 120;

// Update check of the mobile apps (Android: offers the new .apk). Same data as the « Application » page.
export async function GET() {
  const release = await latestRelease();
  if (!release) return NextResponse.json(null, { status: 503 });
  const first = (p: 'android' | 'ios') => release.downloads[p]?.[0]?.url ?? null;
  return NextResponse.json(
    { version: release.version, beta: release.beta, url: release.url, android: first('android'), ios: first('ios') },
    // Short: a new release must reach the apps' update check quickly.
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
