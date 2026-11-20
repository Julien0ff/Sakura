import { CHANGELOG } from './changelog.ts';
import { getLastMessageId, setLastMessageId, deleteWebhookMessage } from './discord-state.ts';

export const SAKURA_COLOR = 0xff69b4; // Sakura Pink
export const SAKURA_URL = 'https://sakura.thefoxy.me';
export const SAKURA_AVATAR = `${SAKURA_URL}/icon-512.png`;

export interface SendWebhookOptions {
  rotateKey?: 'episodes' | 'animes' | 'changelog';
  wait?: boolean;
}

export interface WebhookSendResult {
  ok: boolean;
  status?: number;
  messageId?: string;
  error?: string;
}

export function cleanDescription(raw?: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\(Source:.*?\)/gi, '')
    .trim();
  text = text.replace(/\n\s*\n+/g, '\n\n');
  if (text.length > 280) {
    text = text.slice(0, 277).trim() + '...';
  }
  return text;
}

export async function sendDiscordWebhook(
  url: string,
  payload: Record<string, unknown>,
  options?: SendWebhookOptions
): Promise<WebhookSendResult> {
  if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
    return { ok: false, error: 'URL de webhook Discord invalide' };
  }

  // 1. If rotating, delete previous message before posting the new one
  if (options?.rotateKey) {
    try {
      const prevMessageId = await getLastMessageId(options.rotateKey);
      if (prevMessageId) {
        await deleteWebhookMessage(url, prevMessageId);
      }
    } catch (err) {
      console.warn('[discord-webhook] Failed to clean up previous message:', err);
    }
  }

  // 2. Post new webhook (wait=true if we need to track messageId)
  const shouldWait = Boolean(options?.rotateKey || options?.wait);
  const targetUrl = shouldWait
    ? url.includes('?')
      ? `${url}&wait=true`
      : `${url}?wait=true`
    : url;

  try {
    const res = await fetch(targetUrl, {
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

    let messageId: string | undefined;
    if (shouldWait) {
      const json = await res.json().catch(() => null);
      messageId = json?.id;
      if (options?.rotateKey && messageId) {
        await setLastMessageId(options.rotateKey, messageId);
      }
    }

    return { ok: true, status: res.status, messageId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erreur réseau lors de l’envoi' };
  }
}

/**
 * Searches AniList for anime details (banner, cover, synopsis, score, genres).
 */
export async function resolveAniListMedia(title: string) {
  try {
    const query = `
      query ($search: String) {
        Page(perPage: 3) {
          media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
            id
            title { romaji english native }
            description(asHtml: false)
            bannerImage
            coverImage { extraLarge large color }
            averageScore
            genres
            format
          }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { search: title } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.Page?.media?.[0] || null;
  } catch {
    return null;
  }
}

export interface EpisodePayload {
  title: string;
  lang?: 'vf' | 'vostfr';
  ep?: string | number;
  time?: string;
  date?: string;
  image?: string;
  slug?: string;
  anilistId?: number;
}

/**
 * Dispatches an individual rich episode release card with artwork (kept in the channel).
 */
export async function dispatchEpisodesWebhook(
  targetUrl?: string,
  customEpisode?: EpisodePayload
): Promise<WebhookSendResult> {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_EPISODES;
  if (!url) return { ok: false, error: 'Aucun webhook Nouveaux Épisodes configuré' };

  let episode: any = customEpisode;

  // If no custom episode passed, find the most relevant from /api/planning or AniList
  if (!episode) {
    try {
      const planRes = await fetch(`${SAKURA_URL}/api/planning`, { next: { revalidate: 60 } });
      if (planRes.ok) {
        const planningItems = await planRes.json();
        if (Array.isArray(planningItems) && planningItems.length > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayItems = planningItems.filter((i: any) => i.date === todayStr);
          // Pick today's first item, or first item overall if none today yet
          episode = todayItems[0] || planningItems[0];
        }
      }
    } catch (e) {
      console.warn('Failed to load planning for episode webhook:', e);
    }
  }

  // Fallback to AniList airing schedule if still nothing
  if (!episode) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const query = `
        query ($from: Int, $to: Int) {
          Page(page: 1, perPage: 1) {
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) {
              episode
              airingAt
              media {
                id
                title { romaji english }
                bannerImage
                coverImage { extraLarge large color }
                description(asHtml: false)
                averageScore
                genres
                format
              }
            }
          }
        }
      `;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { from: now - 86400, to: now + 86400 } }),
      });
      const data = await res.json();
      const airing = data?.data?.Page?.airingSchedules?.[0];
      if (airing) {
        episode = {
          title: airing.media?.title?.english || airing.media?.title?.romaji || 'Nouvel Épisode',
          ep: airing.episode,
          lang: 'vostfr',
          anilist: airing.media,
          anilistId: airing.media?.id,
        };
      }
    } catch {
      // Fallback
    }
  }

  const animeTitle = episode?.title || 'Nouvel Épisode';
  const lang = (episode?.lang || 'vostfr').toLowerCase();
  const epLabel = episode?.ep ? `Épisode ${episode.ep}` : episode?.label || 'Nouvel Épisode';
  const time = episode?.time || '';

  // Resolve artwork & metadata from AniList
  const anilist = episode?.anilist || (await resolveAniListMedia(animeTitle));
  const anilistId = episode?.anilistId || anilist?.id;

  const bannerImage = anilist?.bannerImage || episode?.image || null;
  const coverImage = anilist?.coverImage?.extraLarge || anilist?.coverImage?.large || episode?.image || null;
  const score = anilist?.averageScore ? `${(anilist.averageScore / 10).toFixed(1)}/10` : null;
  const genres = anilist?.genres && anilist.genres.length > 0 ? anilist.genres.slice(0, 3).join(', ') : null;
  const synopsis = cleanDescription(anilist?.description);

  const watchUrl = anilistId ? `${SAKURA_URL}/anime?id=${anilistId}` : SAKURA_URL;
  const langBadge = lang === 'vf' ? '🇫🇷 VF (Version Française)' : '🇯🇵 VOSTFR';

  const fields = [
    { name: '📺 Anime', value: `**${animeTitle}**`, inline: true },
    { name: '🔢 Numéro', value: `**${epLabel}**`, inline: true },
    { name: '🗣️ Version', value: langBadge, inline: true },
  ];

  if (time) {
    fields.push({ name: '⏰ Heure de sortie', value: `${time} (Heure de Paris)`, inline: true });
  }
  if (score) {
    fields.push({ name: '⭐ Note AniList', value: `⭐ ${score}`, inline: true });
  }
  if (genres) {
    fields.push({ name: '🎭 Genres', value: genres, inline: true });
  }

  fields.push({
    name: '🍿 Visionnage Immédiat',
    value: `[▶️ **Regarder l'épisode sur SAKURA**](${watchUrl}) • [📅 **Calendrier**](${SAKURA_URL}/calendar)`,
    inline: false,
  });

  const embed: any = {
    title: `🎬 [${lang.toUpperCase()}] ${animeTitle} — ${epLabel}`,
    url: watchUrl,
    description: `Un nouvel épisode de **${animeTitle}** est maintenant disponible sur **SAKURA** !\n${
      synopsis ? `\n> *« ${synopsis} »*\n` : ''
    }`,
    color: SAKURA_COLOR,
    fields,
    footer: { text: 'SAKURA • Sorties Épisodes en Direct', icon_url: SAKURA_AVATAR },
    timestamp: new Date().toISOString(),
  };

  // Large banner artwork at bottom
  if (bannerImage) {
    embed.image = { url: bannerImage };
  } else if (coverImage) {
    embed.image = { url: coverImage };
  }

  // Portrait cover thumbnail on top-right
  if (coverImage) {
    embed.thumbnail = { url: coverImage };
  }

  // Every release stays in the channel as a log: no rotation.
  return sendDiscordWebhook(url, { embeds: [embed] });
}

/**
 * Dispatches an individual rich anime release/addition card with artwork (kept in the channel).
 */
export async function dispatchAnimesWebhook(
  targetUrl?: string,
  customAnimeId?: number
): Promise<WebhookSendResult> {
  const url = targetUrl || process.env.DISCORD_WEBHOOK_ANIMES;
  if (!url) return { ok: false, error: 'Aucun webhook Nouveaux Animes configuré' };

  let anime: any = null;
  try {
    const query = `
      query ($id: Int) {
        Page(page: 1, perPage: 1) {
          media(id: $id, type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
            id
            title { romaji english native }
            description(asHtml: false)
            averageScore
            genres
            format
            bannerImage
            coverImage { extraLarge large color }
          }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { id: customAnimeId } }),
    });
    const json = await res.json();
    anime = json?.data?.Page?.media?.[0] || null;
  } catch (err) {
    console.warn('AniList fetch error for animes webhook:', err);
  }

  if (!anime) {
    return { ok: false, error: 'Impossible de récupérer les informations de l’anime' };
  }

  const title = anime.title?.english || anime.title?.romaji || 'Anime SAKURA';
  const originalTitle = anime.title?.romaji !== title ? anime.title?.romaji : null;
  const synopsis = cleanDescription(anime.description);
  const score = anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)}/10` : null;
  const genres = (anime.genres || []).slice(0, 4).join(', ');
  const format = anime.format || 'Série TV';
  const animeUrl = `${SAKURA_URL}/anime?id=${anime.id}`;

  const fields = [
    { name: '📺 Format', value: format, inline: true },
    { name: '⭐ Note Moyenne', value: score ? `⭐ ${score}` : 'N/C', inline: true },
    { name: '🗣️ Versions', value: 'VF & VOSTFR sans publicité', inline: true },
  ];

  if (genres) {
    fields.push({ name: '🎭 Genres', value: genres, inline: true });
  }
  if (originalTitle) {
    fields.push({ name: '🏷️ Titre Original', value: originalTitle, inline: true });
  }

  fields.push({
    name: '🍿 Accès Direct au Catalogue',
    value: `[▶️ **Regarder maintenant sur SAKURA**](${animeUrl}) • [🔍 **Explorer le catalogue**](${SAKURA_URL}/discover)`,
    inline: false,
  });

  const embed: any = {
    title: `🌸 NOUVEL ANIME AU CATALOGUE — ${title}`,
    url: animeUrl,
    description: `Découvrez **${title}**, disponible dès maintenant en streaming haute qualité sur **SAKURA** !\n${
      synopsis ? `\n> *« ${synopsis} »*\n` : ''
    }`,
    color: SAKURA_COLOR,
    fields,
    footer: { text: 'SAKURA • Catalogue & Tendances', icon_url: SAKURA_AVATAR },
    timestamp: new Date().toISOString(),
  };

  if (anime.bannerImage) {
    embed.image = { url: anime.bannerImage };
  } else if (anime.coverImage?.extraLarge) {
    embed.image = { url: anime.coverImage.extraLarge };
  }

  if (anime.coverImage?.extraLarge || anime.coverImage?.large) {
    embed.thumbnail = { url: anime.coverImage.extraLarge || anime.coverImage.large };
  }

  return sendDiscordWebhook(url, { embeds: [embed] });
}

export async function dispatchChangelogWebhook(targetUrl?: string): Promise<WebhookSendResult> {
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

export async function dispatchLinksWebhook(targetUrl?: string): Promise<WebhookSendResult> {
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
          {
            name: '📲 Télécharger l\'Application (iOS, Android, Windows, Linux)',
            value: `[sakura.thefoxy.me/app](${SAKURA_URL}/app)`,
            inline: false,
          },
          {
            name: '💬 Serveur Communautaire Discord',
            value: '[Rejoindre le Discord](https://discord.gg/YYBY6TrUSZ)',
            inline: false,
          },
        ],
        footer: { text: 'SAKURA • Liens Officiels', icon_url: SAKURA_AVATAR },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function dispatchRulesWebhook(targetUrl?: string): Promise<WebhookSendResult> {
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
            value:
              'Pour signaler un problème sur le lecteur ou un anime, utilisez les salons dédiés et fournissez le titre précis et l’épisode.',
          },
        ],
        footer: { text: 'SAKURA • Équipe de Modération', icon_url: SAKURA_AVATAR },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
