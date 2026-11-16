import fs from 'fs';
import path from 'path';

const action = process.argv[2] || 'changelog';
const SAKURA_COLOR = 0xff69b4;
const SAKURA_URL = 'https://sakura.thefoxy.me';
const SAKURA_AVATAR = `${SAKURA_URL}/icon-512.png`;

const STATE_FILE = path.join(process.cwd(), 'data/discord-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('⚠️ Erreur lecture discord-state.json:', err.message);
  }
  return { lastMessages: {} };
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('⚠️ Erreur écriture discord-state.json:', err.message);
  }
}

async function deletePreviousMessage(webhookUrl, messageId) {
  if (!webhookUrl || !messageId) return;
  try {
    const cleanUrl = webhookUrl.split('?')[0].replace(/\/messages\/?.*$/, '');
    const deleteUrl = `${cleanUrl}/messages/${messageId}`;
    const res = await fetch(deleteUrl, { method: 'DELETE' });
    if (res.status === 204 || res.status === 404) {
      console.log(`🗑️ Ancien message supprimé (${messageId}, statut ${res.status})`);
    } else {
      console.warn(`⚠️ Statut inattendu lors de la suppression de ${messageId}:`, res.status);
    }
  } catch (err) {
    console.warn('⚠️ Échec de la suppression de l’ancien message:', err.message);
  }
}

async function sendWebhook(url, payload, rotateKey) {
  if (!url) {
    console.error('❌ URL de webhook manquante pour', action);
    process.exit(1);
  }

  const state = loadState();

  // 1. Supprimer le message précédent si rotateKey est activé
  if (rotateKey && state.lastMessages?.[rotateKey]) {
    await deletePreviousMessage(url, state.lastMessages[rotateKey]);
  }

  // 2. Envoyer le nouveau message avec ?wait=true
  const waitUrl = url.includes('?') ? `${url}&wait=true` : `${url}?wait=true`;
  const res = await fetch(waitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'SAKURA',
      avatar_url: SAKURA_AVATAR,
      ...payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Échec Discord (${res.status}):`, text);
    process.exit(1);
  }

  const data = await res.json().catch(() => null);
  if (rotateKey && data?.id) {
    state.lastMessages = state.lastMessages || {};
    state.lastMessages[rotateKey] = data.id;
    saveState(state);
    console.log(`💾 Nouveau message enregistré pour [${rotateKey}]: ${data.id}`);
  }

  console.log(`✅ Succès Discord (${action}) !`);
}

function cleanDescription(raw) {
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

async function resolveAniList(title) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: title } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.Page?.media?.[0] || null;
  } catch {
    return null;
  }
}

async function announceChangelog() {
  const url = process.env.DISCORD_WEBHOOK_CHANGELOG;
  const changelogPath = path.join(process.cwd(), 'src/lib/changelog.ts');
  const code = fs.readFileSync(changelogPath, 'utf-8');

  // Parse latest release entry from changelog.ts
  const matchId = code.match(/id:\s*['"]([^'"]+)['"]/);
  const matchDate = code.match(/date:\s*['"]([^'"]+)['"]/);
  const matchTitle = code.match(/title:\s*['"]([^'"]+)['"]/);

  const date = matchDate ? matchDate[1] : 'Mise à jour';
  const title = matchTitle ? matchTitle[1] : 'Nouvelle version SAKURA';
  const id = matchId ? matchId[1] : '';

  // Extract features
  const features = [];
  const featureMatches = code.matchAll(/{\s*text:\s*['"]([^'"]+)['"]\s*}/g);
  for (const m of featureMatches) {
    features.push(m[1]);
    if (features.length >= 8) break;
  }

  const featureText = features.map((f) => `• ${f}`).join('\n');

  const embed = {
    title: `🌸 Mise à jour SAKURA — ${title}`,
    description: `Une nouvelle version de SAKURA vient d'être déployée (${date}) !\n\n[Ouvrir l'application SAKURA](${SAKURA_URL})`,
    color: SAKURA_COLOR,
    fields: featureText ? [{ name: '✨ Nouveautés & Corrections', value: featureText.slice(0, 1024) }] : [],
    footer: { text: `SAKURA Version • ${id}`, icon_url: SAKURA_AVATAR },
    timestamp: new Date().toISOString(),
  };

  await sendWebhook(url, { embeds: [embed] });
}

async function announceEpisodes() {
  const url = process.env.DISCORD_WEBHOOK_EPISODES;

  let episode = null;
  try {
    const res = await fetch(`${SAKURA_URL}/api/planning`);
    if (res.ok) {
      const planning = await res.json();
      if (Array.isArray(planning) && planning.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayItems = planning.filter((i) => i.date === todayStr);
        episode = todayItems[0] || planning[0];
      }
    }
  } catch (err) {
    console.warn('Planning fetch warning:', err.message);
  }

  // Fallback to AniList airing
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
    } catch (err) {
      console.warn('AniList airing fallback warning:', err.message);
    }
  }

  const animeTitle = episode?.title || 'Nouvel Épisode';
  const lang = (episode?.lang || 'vostfr').toLowerCase();
  const epLabel = episode?.ep ? `Épisode ${episode.ep}` : episode?.label || 'Nouvel Épisode';
  const time = episode?.time || '';

  const anilist = episode?.anilist || (await resolveAniList(animeTitle));
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

  const embed = {
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

  if (bannerImage) {
    embed.image = { url: bannerImage };
  } else if (coverImage) {
    embed.image = { url: coverImage };
  }

  if (coverImage) {
    embed.thumbnail = { url: coverImage };
  }

  await sendWebhook(url, { embeds: [embed] }, 'episodes');
}

async function announceAnimes() {
  const url = process.env.DISCORD_WEBHOOK_ANIMES;
  let anime = null;
  try {
    const query = `
      query {
        Page(page: 1, perPage: 1) {
          media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    anime = json?.data?.Page?.media?.[0] || null;
  } catch (err) {
    console.warn('AniList fetch warning:', err.message);
  }

  if (!anime) {
    console.error('❌ Aucun anime trouvé pour l’annonce');
    process.exit(1);
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

  const embed = {
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

  await sendWebhook(url, { embeds: [embed] }, 'animes');
}

if (action === 'episodes') {
  announceEpisodes();
} else if (action === 'animes') {
  announceAnimes();
} else {
  announceChangelog();
}
