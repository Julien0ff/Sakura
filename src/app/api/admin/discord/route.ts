import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { CHANGELOG } from '@/lib/changelog';

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

const DEFAULT_CONFIG: DiscordWebhooksConfig = {
  episodesUrl: '',
  episodesEnabled: true,
  animesUrl: '',
  animesEnabled: true,
  changelogUrl: '',
  changelogEnabled: true,
  linksUrl: '',
  linksEnabled: true,
  rulesUrl: '',
  rulesEnabled: true,
};

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'discord-webhooks.json');

const SAKURA_COLOR = 0xff69b4; // Sakura Pink
const SAKURA_AVATAR = 'https://raw.githubusercontent.com/Julien0ff/Sakura/main/public/icon-512.png';
const SAKURA_URL = 'https://sakura.thefoxy.me';

async function loadConfig(): Promise<DiscordWebhooksConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(config: DiscordWebhooksConfig): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save discord webhooks config:', err);
  }
}

async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
    return { ok: false, error: 'URL de webhook invalide' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'SAKURA',
        avatar_url: SAKURA_AVATAR,
        ...payload,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText || `Erreur HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erreur réseau lors de l’envoi' };
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

      const result = await sendWebhook(url, {
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

    if (action === 'send_changelog') {
      const { url } = body;
      const latest = CHANGELOG[0];
      if (!latest) return NextResponse.json({ ok: false, error: 'Aucun changelog trouvé' });

      const featureText = latest.features.map((f) => `• ${f.text}${f.beta ? ' *(Bêta)*' : ''}`).join('\n');
      const fixText = latest.fixes.map((f) => `• ${f.text}`).join('\n');

      const fields = [];
      if (featureText) {
        fields.push({ name: '✨ Nouveautés & Améliorations', value: featureText.slice(0, 1024) });
      }
      if (fixText) {
        fields.push({ name: '🛠️ Corrections', value: fixText.slice(0, 1024) });
      }

      const result = await sendWebhook(url, {
        embeds: [
          {
            title: `🌸 Mise à jour SAKURA — ${latest.title}`,
            description: `Une nouvelle version de SAKURA est disponible (${latest.date}) !\n[Ouvrir l'application](${SAKURA_URL})`,
            color: SAKURA_COLOR,
            fields,
            footer: { text: `SAKURA Version • ${latest.id}`, icon_url: SAKURA_AVATAR },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json(result);
    }

    if (action === 'send_links') {
      const { url } = body;
      const result = await sendWebhook(url, {
        embeds: [
          {
            title: '🌸 Liens Utiles & Officiels SAKURA',
            description: 'Retrouvez toutes les adresses officielles du projet SAKURA :',
            color: SAKURA_COLOR,
            fields: [
              { name: '🌐 Site Web & Web App', value: `[Accéder à SAKURA](${SAKURA_URL})`, inline: false },
              { name: '💻 Application Desktop (Windows / Linux)', value: '[Télécharger sur GitHub](https://github.com/Julien0ff/Sakura/releases/latest)', inline: false },
              { name: '📱 Applications Mobiles (Android APK & iOS)', value: `[Page de Téléchargement](${SAKURA_URL}/app)`, inline: false },
              { name: '💬 Serveur Communautaire Discord', value: '[Rejoindre le Discord](https://discord.gg/sakura-anime)', inline: false },
              { name: '🐛 Dépôt GitHub & Signaler un bug', value: '[GitHub Julien0ff/Sakura](https://github.com/Julien0ff/Sakura)', inline: false },
            ],
            footer: { text: 'SAKURA • Liens Officiels', icon_url: SAKURA_AVATAR },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json(result);
    }

    if (action === 'send_rules') {
      const { url } = body;
      const result = await sendWebhook(url, {
        embeds: [
          {
            title: '📜 Règlement du Serveur SAKURA',
            description: 'Bienvenue sur le serveur Discord officiel de **SAKURA** !\nMerci de lire et respecter les règles suivantes pour garantir une communauté agréable et bienveillante pour tous.',
            color: SAKURA_COLOR,
            fields: [
              {
                name: '1. Respect & Bienveillance',
                value: 'Tout propos haineux, discriminatoire, insultant, agressif ou déplacé est strictement interdit.',
              },
              {
                name: '2. Balises Spoilers Obligatoires',
                value: 'Respectez l’expérience de visionnage des autres membres. Utilisez impérativement les balises spoiler `|| spoiler ||` pour toute intrigue récente ou non adaptée.',
              },
              {
                name: '3. Pas de Publicité ni de Spam',
                value: 'L’auto-promotion, le spam, les mentions abusives et l’envoi de liens non sollicités en messages privés sont proscrits.',
              },
              {
                name: '4. Contenu NSFW & Illégal Strictement Interdit',
                value: 'Aucun contenu explicite, pornographique ou choquant n’est toléré sur l’ensemble du serveur.',
              },
              {
                name: '5. Entraide & Bugs',
                value: 'Pour signaler un problème sur le lecteur ou un anime, utilisez les salons dédiés et fournissez le titre précis et l’épisode.',
              },
            ],
            footer: { text: 'SAKURA • Équipe de Modération', icon_url: SAKURA_AVATAR },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, error: 'Action inconnue' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}

