import fs from 'fs';
import path from 'path';

const action = process.argv[2] || 'changelog';
const SAKURA_COLOR = 0xff69b4;
const SAKURA_URL = 'https://sakura.thefoxy.me';
const SAKURA_AVATAR = `${SAKURA_URL}/icon-512.png`;

async function sendWebhook(url, payload) {
  if (!url) {
    console.error('❌ URL de webhook manquante pour', action);
    process.exit(1);
  }
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
    const text = await res.text();
    console.error(`❌ Échec Discord (${res.status}):`, text);
    process.exit(1);
  }
  console.log(`✅ Succès Discord (${action}) !`);
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
  let planning = [];
  try {
    const res = await fetch(`${SAKURA_URL}/api/planning`);
    if (res.ok) planning = await res.json();
  } catch (err) {
    console.warn('Planning fetch warning:', err);
  }

  const now = new Date();
  const todayStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizedToday = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  const fields = (planning || []).slice(0, 12).map((item) => ({
    name: `${item.lang === 'vf' ? '🇫🇷 VF' : '🇯🇵 VOSTFR'} • ${item.title || 'Anime'}`,
    value: `Épisode ${item.ep || '1'}${item.time ? ` (${item.time})` : ''}\n[Regarder sur SAKURA](${SAKURA_URL}${item.anilist?.id ? `/anime?id=${item.anilist.id}` : ''})`,
    inline: true,
  }));

  const embed = {
    title: `🎬 Sorties d'Épisodes du Jour — ${capitalizedToday}`,
    description:
      fields.length > 0
        ? 'Retrouvez les nouveaux épisodes disponibles aujourd’hui sur **SAKURA** :'
        : 'Consultez le calendrier complet des sorties d’animes sur SAKURA !',
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

  await sendWebhook(url, { embeds: [embed] });
}

async function announceAnimes() {
  const url = process.env.DISCORD_WEBHOOK_ANIMES;
  let trending = [];
  try {
    const query = `
      query {
        Page(page: 1, perPage: 6) {
          media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
            id
            title { romaji english }
            averageScore
            genres
            bannerImage
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
    trending = json?.data?.Page?.media || [];
  } catch (err) {
    console.warn('AniList fetch warning:', err);
  }

  const fields = trending.slice(0, 6).map((m) => {
    const title = m.title?.english || m.title?.romaji || 'Anime';
    const score = m.averageScore ? `⭐ ${m.averageScore / 10}/10` : '';
    const genres = (m.genres || []).slice(0, 3).join(', ');
    return {
      name: title,
      value: `${genres ? `*${genres}* • ` : ''}${score}\n[Découvrir sur SAKURA](${SAKURA_URL}/anime?id=${m.id})`,
      inline: true,
    };
  });

  const featured = trending[0];
  const embed = {
    title: '🌸 Nouveautés & Tendances du Catalogue SAKURA',
    description: 'Découvrez les animes les plus populaires à regarder en VF et VOSTFR sans publicité sur **SAKURA** !',
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

  await sendWebhook(url, { embeds: [embed] });
}

if (action === 'episodes') {
  announceEpisodes();
} else if (action === 'animes') {
  announceAnimes();
} else {
  announceChangelog();
}
