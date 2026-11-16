import { CHANGELOG } from '@/lib/changelog';

export const SAKURA_COLOR = 0xff69b4; // Sakura Pink
export const SAKURA_URL = 'https://sakura.thefoxy.me';
export const SAKURA_AVATAR = `${SAKURA_URL}/icon-512.png`;

export async function sendDiscordWebhook(
  url: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
    return { ok: false, error: 'URL de webhook Discord invalide' };
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

export async function dispatchEpisodesWebhook(targetUrl?: string) {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_EPISODES;
  if (!url) return { ok: false, error: 'Aucun webhook Nouveaux Épisodes configuré' };

  let planningItems: any[] = [];
  try {
    const planRes = await fetch(`${SAKURA_URL}/api/planning`, { next: { revalidate: 60 } });
    if (planRes.ok) {
      planningItems = await planRes.json();
    }
  } catch {
    // Planning fallback
  }

  const now = new Date();
  const todayStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizedToday = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  const fields = (planningItems || []).slice(0, 12).map((item: any) => ({
    name: `${item.lang === 'vf' ? '🇫🇷 VF' : '🇯🇵 VOSTFR'} • ${item.title || 'Anime'}`,
    value: `Épisode ${item.ep || '1'}${item.time ? ` (${item.time})` : ''}\n[Regarder sur SAKURA](${SAKURA_URL}${item.anilist?.id ? `/anime?id=${item.anilist.id}` : ''})`,
    inline: true,
  }));

  const embed: any = {
    title: `🎬 Sorties d'Épisodes du Jour — ${capitalizedToday}`,
    description:
      fields.length > 0
        ? 'Retrouvez les nouveaux épisodes diffusés aujourd’hui sur **SAKURA** :'
        : 'Consultez les nouveaux épisodes et les sorties récentes directement sur SAKURA !',
    color: SAKURA_COLOR,
    fields:
      fields.length > 0
        ? fields
        : [
            {
              name: '📺 Calendrier Complet',
              value: `[Voir toutes les sorties de la semaine sur SAKURA](${SAKURA_URL}/calendar)`,
              inline: false,
            },
          ],
    footer: { text: 'SAKURA • Nouveaux Épisodes', icon_url: SAKURA_AVATAR },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook(url, { embeds: [embed] });
}

export async function dispatchAnimesWebhook(targetUrl?: string) {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_ANIMES;
  if (!url) return { ok: false, error: 'Aucun webhook Nouveaux Animes configuré' };

  let trendingList: any[] = [];
  try {
    const query = `
      query {
        Page(page: 1, perPage: 6) {
          media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
            id
            title { romaji english }
            description(asHtml: false)
            averageScore
            genres
            bannerImage
          }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    trendingList = json?.data?.Page?.media || [];
  } catch {
    // Fallback
  }

  const fields = trendingList.slice(0, 6).map((m: any) => {
    const title = m.title?.english || m.title?.romaji || 'Anime';
    const score = m.averageScore ? `⭐ ${m.averageScore / 10}/10` : '';
    const genres = (m.genres || []).slice(0, 3).join(', ');
    return {
      name: title,
      value: `${genres ? `*${genres}* • ` : ''}${score}\n[Découvrir sur SAKURA](${SAKURA_URL}/anime?id=${m.id})`,
      inline: true,
    };
  });

  const featured = trendingList[0];
  const embed: any = {
    title: '🌸 Nouveautés & Tendances du Catalogue SAKURA',
    description: 'Découvrez les animes populaires et ajouts récents à regarder en VF et VOSTFR sans publicité sur **SAKURA** !',
    color: SAKURA_COLOR,
    fields:
      fields.length > 0
        ? fields
        : [
            {
              name: '🔍 Explorer le Catalogue',
              value: `[Parcourir tous les animes sur SAKURA](${SAKURA_URL}/discover)`,
              inline: false,
            },
          ],
    image: featured?.bannerImage ? { url: featured.bannerImage } : undefined,
    footer: { text: 'SAKURA • Nouveautés Catalogue', icon_url: SAKURA_AVATAR },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook(url, { embeds: [embed] });
}

export async function dispatchChangelogWebhook(targetUrl?: string) {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_CHANGELOG;
  if (!url) return { ok: false, error: 'Aucun webhook Changelog configuré' };

  const latest = CHANGELOG[0];
  if (!latest) return { ok: false, error: 'Aucun changelog trouvé' };

  const featureText = latest.features.map((f) => `• ${f.text}${f.beta ? ' *(Bêta)*' : ''}`).join('\n');
  const fixText = latest.fixes.map((f) => `• ${f.text}`).join('\n');

  const fields = [];
  if (featureText) {
    fields.push({ name: '✨ Nouveautés & Améliorations', value: featureText.slice(0, 1024) });
  }
  if (fixText) {
    fields.push({ name: '🛠️ Corrections', value: fixText.slice(0, 1024) });
  }

  const embed = {
    title: `🌸 Mise à jour SAKURA — ${latest.title}`,
    description: `Une nouvelle version de SAKURA est disponible (${latest.date}) !\n[Ouvrir l'application SAKURA](${SAKURA_URL})`,
    color: SAKURA_COLOR,
    fields,
    footer: { text: `SAKURA Version • ${latest.id}`, icon_url: SAKURA_AVATAR },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook(url, { embeds: [embed] });
}

export async function dispatchLinksWebhook(targetUrl?: string) {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_LINKS;
  if (!url) return { ok: false, error: 'Aucun webhook Liens configuré' };

  return sendDiscordWebhook(url, {
    embeds: [
      {
        title: '🌸 Liens Utiles & Officiels SAKURA',
        description: 'Retrouvez toutes les adresses officielles du projet SAKURA :',
        color: SAKURA_COLOR,
        fields: [
          { name: '🌐 Site Web & Web App', value: `[Accéder à SAKURA](${SAKURA_URL})`, inline: false },
          { name: '📲 Télécharger l\'Application (iOS, Android, Windows, Linux)', value: `[sakura.thefoxy.me/app](${SAKURA_URL}/app)`, inline: false },
          { name: '💬 Serveur Communautaire Discord', value: '[Rejoindre le Discord](https://discord.gg/YYBY6TrUSZ)', inline: false },
        ],
        footer: { text: 'SAKURA • Liens Officiels', icon_url: SAKURA_AVATAR },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function dispatchRulesWebhook(targetUrl?: string) {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_RULES;
  if (!url) return { ok: false, error: 'Aucun webhook Règlement configuré' };

  return sendDiscordWebhook(url, {
    embeds: [
      {
        title: '📜 Règlement du Serveur SAKURA',
        description:
          'Bienvenue sur le serveur Discord officiel de **SAKURA** !\nMerci de lire et respecter les règles suivantes pour garantir une communauté agréable et bienveillante pour tous.',
        color: SAKURA_COLOR,
        fields: [
          {
            name: '1. Respect & Bienveillance',
            value: 'Tout propos haineux, discriminatoire, insultant, agressif ou déplacé est strictement interdit.',
          },
          {
            name: '2. Balises Spoilers Obligatoires',
            value:
              'Respectez l’expérience de visionnage des autres membres. Utilisez impérativement les balises spoiler `|| spoiler ||` pour toute intrigue récente ou non adaptée.',
          },
          {
            name: '3. Pas de Publicité ni de Spam',
            value:
              'L’auto-promotion, le spam, les mentions abusives et l’envoi de liens non sollicités en messages privés sont proscrits.',
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
}
