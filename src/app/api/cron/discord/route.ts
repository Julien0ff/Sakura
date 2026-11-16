import { NextRequest, NextResponse } from 'next/server';
import {
  dispatchEpisodesWebhook,
  dispatchAnimesWebhook,
  dispatchChangelogWebhook,
} from '@/lib/discord-webhook-dispatcher';

/**
 * Endpoint for scheduled cron runs (Vercel Cron / GitHub Actions / uptime monitors).
 * Supports ?type=episodes | ?type=animes | ?type=changelog
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'episodes';

  try {
    if (type === 'episodes') {
      const res = await dispatchEpisodesWebhook();
      return NextResponse.json({ ok: res.ok, type, res });
    }

    if (type === 'animes') {
      const res = await dispatchAnimesWebhook();
      return NextResponse.json({ ok: res.ok, type, res });
    }

    if (type === 'changelog') {
      const res = await dispatchChangelogWebhook();
      return NextResponse.json({ ok: res.ok, type, res });
    }

    return NextResponse.json({ ok: false, error: `Type inconnu: ${type}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erreur lors du cron Discord' }, { status: 500 });
  }
}
