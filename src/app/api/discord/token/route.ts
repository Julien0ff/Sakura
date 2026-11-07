import { NextResponse } from 'next/server';
import { parseTokenRequest, readTokens, tokenForm } from '@/lib/discord-token';

// Mobile apps (Discord status): exchanges the Social SDK's authorization code, or refreshes the
// token, with the Discord app's secret (Vercel variable DISCORD_CLIENT_SECRET, never sent to apps).
// 400 = Discord refused (code used / link revoked): the app goes back to « Relier Discord ».
export async function POST(request: Request) {
  const secret = process.env.DISCORD_CLIENT_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const req = parseTokenRequest(await request.json().catch(() => null));
  if (!req) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  let res: Response;
  try {
    res = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: tokenForm(req, secret),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'discord_unreachable' }, { status: 502 });
  }
  const tokens = readTokens(await res.json().catch(() => null));
  if (!res.ok || !tokens) {
    const refused = res.status === 400 || res.status === 401;
    return NextResponse.json({ error: refused ? 'invalid_grant' : 'discord_error' }, { status: refused ? 400 : 502 });
  }
  return NextResponse.json(tokens, { headers: { 'Cache-Control': 'no-store' } });
}
