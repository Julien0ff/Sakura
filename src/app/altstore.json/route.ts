import { NextResponse } from 'next/server';
import { altstoreSource } from '@/lib/app-release';
import { latestRelease } from '@/lib/app-release-server';

// Refreshed every 2 min even when GitHub didn't answer at build time (latestRelease has a deadline).
export const revalidate = 120;

const ORIGIN = 'https://sakura.thefoxy.me';

// AltStore / SideStore source: added once on the iPhone, it offers every new .ipa as an update.
export async function GET() {
  const release = await latestRelease();
  return NextResponse.json(altstoreSource(release, ORIGIN), {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
