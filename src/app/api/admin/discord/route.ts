import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  sendDiscordWebhook,
  dispatchEpisodesWebhook,
  dispatchAnimesWebhook,
  dispatchChangelogWebhook,
  dispatchLinksWebhook,
  dispatchRulesWebhook,
  SAKURA_COLOR,
  SAKURA_AVATAR,
} from '@/lib/discord-webhook-dispatcher';

export interface DiscordWebhooksConfig {
  episodesUrl: string;
  episodesEnabled: boolean;
  animesUrl: string;
  animesEnabled: boolean;
  changelogUrl: string;
  changelogEnabled: boolean;
  linksUrl: string;
  linksEnabled: boolean;
  rulesUrl: string;
  rulesEnabled: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_CONFIG_PATH = path.join(DATA_DIR, 'discord-webhooks.json');
const TMP_CONFIG_PATH = path.join(os.tmpdir(), 'sakura-discord-webhooks.json');

function getDefaults(): DiscordWebhooksConfig {
  return {
    episodesUrl: process.env.DISCORD_WEBHOOK_EPISODES || '',
    episodesEnabled: true,
    animesUrl: process.env.DISCORD_WEBHOOK_ANIMES || '',
    animesEnabled: true,
    changelogUrl: process.env.DISCORD_WEBHOOK_CHANGELOG || '',
    changelogEnabled: true,
    linksUrl: '',
    linksEnabled: true,
    rulesUrl: '',
    rulesEnabled: true,
  };
}

async function loadConfig(): Promise<DiscordWebhooksConfig> {
  const defaults = getDefaults();
  // 1. Try local data dir (if exists)
  try {
    const raw = await fs.readFile(LOCAL_CONFIG_PATH, 'utf-8');
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // 2. Try tmp config file
    try {
      const raw = await fs.readFile(TMP_CONFIG_PATH, 'utf-8');
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }
}

async function saveConfig(config: DiscordWebhooksConfig): Promise<void> {
  // Save to tmpdir (always writable in serverless)
  try {
    await fs.writeFile(TMP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save to tmp config:', err);
  }
  // Try local data dir (development)
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Expected on read-only serverless filesystems
  }
}

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'save') {
      const config: DiscordWebhooksConfig = {
        episodesUrl: String(body.episodesUrl || '').trim(),
        episodesEnabled: Boolean(body.episodesEnabled),
        animesUrl: String(body.animesUrl || '').trim(),
        animesEnabled: Boolean(body.animesEnabled),
        changelogUrl: String(body.changelogUrl || '').trim(),
        changelogEnabled: Boolean(body.changelogEnabled),
        linksUrl: String(body.linksUrl || '').trim(),
        linksEnabled: Boolean(body.linksEnabled),
        rulesUrl: String(body.rulesUrl || '').trim(),
        rulesEnabled: Boolean(body.rulesEnabled),
      };
      await saveConfig(config);
      return NextResponse.json({ ok: true, config });
    }

    if (action === 'test') {
      const { target, url } = body;
      const targetLabels: Record<string, string> = {
        episodes: 'Sorties de nouveaux épisodes',
        animes: 'Nouveaux animes ajoutés',
        changelog: 'Changelogs automatiques',
        links: 'Liens utiles et officiels',
        rules: 'Règlement du serveur',
      };

      const result = await sendDiscordWebhook(url, {
        embeds: [
          {
            title: '🌸 Test de Webhook Réussi !',
            description: `Le canal Discord reçoit correctement les notifications SAKURA pour :\n**${targetLabels[target] || target}**`,
            color: SAKURA_COLOR,
            fields: [
              { name: 'Statut', value: '✅ Opérationnel', inline: true },
              { name: 'Application', value: 'SAKURA', inline: true },
            ],
            footer: { text: 'SAKURA • Configuration Administrateur', icon_url: SAKURA_AVATAR },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json(result);
    }

    if (action === 'get_episodes') {
      try {
        const planRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://sakura.thefoxy.me'}/api/planning`);
        if (planRes.ok) {
          const items = await planRes.json();
          return NextResponse.json({ ok: true, items });
        }
      } catch {
        // Fallback
      }
      return NextResponse.json({ ok: true, items: [] });
    }

    if (action === 'send_episodes') {
      const result = await dispatchEpisodesWebhook(body.url, body.episode);
      return NextResponse.json(result);
    }

    if (action === 'send_animes') {
      const result = await dispatchAnimesWebhook(body.url, body.animeId);
      return NextResponse.json(result);
    }

    if (action === 'send_changelog') {
      const result = await dispatchChangelogWebhook(body.url);
      return NextResponse.json(result);
    }

    if (action === 'send_links') {
      const result = await dispatchLinksWebhook(body.url);
      return NextResponse.json(result);
    }

    if (action === 'send_rules') {
      const result = await dispatchRulesWebhook(body.url);
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, error: 'Action inconnue' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
