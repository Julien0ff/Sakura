import { NextRequest, NextResponse } from 'next/server';
import {
  dispatchEpisodesWebhook,
  dispatchAnimesWebhook,
  dispatchChangelogWebhook,
} from '@/lib/discord-webhook-dispatcher';

/**
 * Manual trigger (?type=episodes | animes | changelog). Release announcements are scheduled by
 * .github/workflows/discord-announcements.yml, which remembers what was already posted.
 * Requires `Authorization: Bearer $CRON_SECRET`: without it anyone could post in the channels.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }
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
