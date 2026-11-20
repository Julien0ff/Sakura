/**
 * Discord announcements (run by .github/workflows/discord-announcements.yml).
 *
 *   node scripts/discord-announce.mjs changelog   latest entry of src/lib/changelog.ts
 *   node scripts/discord-announce.mjs releases    episodes released since the last run
 *   node scripts/discord-announce.mjs recap       Sunday recap: the week's releases and SAKURA's most watched
 *   add --dry-run to print what would be posted without posting or saving anything (--verbose: fields too).
 *
 * `releases` uses the calendar's sources: VOSTFR from AniList's airing schedule (same filters as
 * /calendar), VF from /api/planning (Anime-Sama). Each episode becomes its own message in
 * DISCORD_WEBHOOK_EPISODES and messages are never deleted, so the channel is a log of releases.
 * A first episode (VOSTFR episode 1) is also announced in DISCORD_WEBHOOK_ANIMES.
 * data/discord-state.json remembers the last run and what was posted (kept by the workflow cache).
 */
import fs from 'fs';
import path from 'path';

const action = process.argv[2] || 'changelog';
const DRY_RUN = process.argv.includes('--dry-run');
const SAKURA_COLOR = 0xff7aa8;
const SAKURA_URL = 'https://sakura.thefoxy.me';
const SAKURA_AVATAR = `${SAKURA_URL}/icon-512.png`;
const ANILIST = 'https://graphql.anilist.co';

const STATE_FILE = path.join(process.cwd(), 'data/discord-state.json');
/** First run (or state lost): only the last hour, no flood of old releases. */
const FIRST_WINDOW_S = 3600;
/** Workflow paused for a long time: at most the last 12 hours. */
const MAX_WINDOW_S = 12 * 3600;
/** Releases without an announced hour sit at 23:59 Paris in the planning: post them from 00:00. */
const UNKNOWN_HOUR_SHIFT = 23 * 3600 + 59 * 60;
const MAX_POSTS_PER_RUN = 40;
const KEEP_KEYS = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowS = () => Math.floor(Date.now() / 1000);

// ───────── State ─────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return { lastCheck: Number(s.lastCheck) || 0, announced: Array.isArray(s.announced) ? s.announced : [] };
    }
  } catch (err) {
    console.warn('⚠️ Lecture de discord-state.json impossible :', err.message);
  }
  return { lastCheck: 0, announced: [] };
}

function saveState(state) {
  if (DRY_RUN) return;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const announced = state.announced.slice(-KEEP_KEYS);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastCheck: state.lastCheck, announced, updatedAt: new Date().toISOString() }, null, 2));
}

// ───────── Discord ─────────

/** Posts one message; retries once on rate limit. Returns true when Discord accepted it. */
async function post(url, payload) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${payload.embeds?.[0]?.title ?? '(message)'}`);
    if (process.argv.includes('--verbose')) for (const f of payload.embeds?.[0]?.fields ?? []) console.log(`  ${f.name}\n    ${f.value.replaceAll('\n', '\n    ')}`);
    return true;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'SAKURA', avatar_url: SAKURA_AVATAR, ...payload }),
    });
    if (res.ok) return true;
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((Number(body.retry_after) || 2) * 1000) + 250);
      continue;
    }
    console.error(`❌ Discord ${res.status} :`, await res.text().catch(() => ''));
    return false;
  }
  return false;
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
  if (text.length > 280) text = text.slice(0, 277).trim() + '...';
  return text;
}

const parisTime = (epochS) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(epochS * 1000));

// ───────── Changelog ─────────

async function announceChangelog() {
  const url = process.env.DISCORD_WEBHOOK_CHANGELOG;
  if (!url) {
    console.error('❌ DISCORD_WEBHOOK_CHANGELOG manquant');
    process.exit(1);
  }
  const code = fs.readFileSync(path.join(process.cwd(), 'src/lib/changelog.ts'), 'utf-8');

  // Latest release entry of changelog.ts
  const id = code.match(/id:\s*['"]([^'"]+)['"]/)?.[1] ?? '';
  const date = code.match(/date:\s*['"]([^'"]+)['"]/)?.[1] ?? 'Mise à jour';
  const title = code.match(/title:\s*['"]([^'"]+)['"]/)?.[1] ?? 'Nouvelle version SAKURA';

  const features = [];
  for (const m of code.matchAll(/{\s*text:\s*['"]([^'"]+)['"]\s*}/g)) {
    features.push(m[1]);
    if (features.length >= 8) break;
  }
  const featureText = features.map((f) => `• ${f}`).join('\n');

  const ok = await post(url, {
    embeds: [
      {
        title: `🌸 Mise à jour SAKURA — ${title}`,
        description: `Une nouvelle version de SAKURA vient d'être déployée (${date}) !\n\n[Ouvrir l'application SAKURA](${SAKURA_URL})`,
        color: SAKURA_COLOR,
        fields: featureText ? [{ name: '✨ Nouveautés & Corrections', value: featureText.slice(0, 1024) }] : [],
        footer: { text: `SAKURA Version • ${id}`, icon_url: SAKURA_AVATAR },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  if (!ok) process.exit(1);
  console.log('✅ Changelog publié');
}

// ───────── Releases ─────────

const MEDIA_FIELDS = `id isAdult countryOfOrigin popularity format episodes
  title { romaji english }
  description(asHtml: false)
  bannerImage
  coverImage { extraLarge large color }
  averageScore
  genres`;

async function anilist(query, variables) {
  const res = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  if (!json.data) throw new Error('AniList : réponse vide');
  return json.data;
}

/** VOSTFR: AniList airing schedule in (from, to], with the calendar's filters. */
async function fetchVostfr(from, to) {
  const query = `query ($from: Int, $to: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt media { ${MEDIA_FIELDS} } }
    }
  }`;
  const out = [];
  for (let page = 1; page <= 6; page++) {
    const data = await anilist(query, { from, to: to + 1, page });
    out.push(...data.Page.airingSchedules);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return out
    .filter((a) => a.media && !a.media.isAdult && a.media.countryOfOrigin === 'JP' && (a.media.popularity ?? 0) > 500)
    .map((a) => ({
      key: `a:${a.media.id}:${a.episode}`,
      lang: 'vostfr',
      at: a.airingAt,
      title: a.media.title.english || a.media.title.romaji || 'Anime',
      episode: a.episode,
      label: null,
      timeKnown: true,
      media: a.media,
      image: null,
    }));
}

/** VF: Anime-Sama planning from the site (already matched to AniList ids). */
async function fetchVf(from, to) {
  const res = await fetch(`${SAKURA_URL}/api/planning`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`planning ${res.status}`);
  const items = await res.json();
  return items
    .filter((p) => p.lang === 'vf' && !p.postponed)
    .map((p) => ({ ...p, at: p.time ? p.airingAt : p.airingAt - UNKNOWN_HOUR_SHIFT }))
    .filter((p) => p.at > from && p.at <= to)
    .map((p) => ({
      key: `v:${p.slug}:${p.date}`,
      lang: 'vf',
      at: p.at,
      title: p.title,
      episode: null,
      label: p.label,
      timeKnown: Boolean(p.time),
      anilistId: p.anilist?.id ?? null,
      media: null,
      image: p.image,
    }));
}

/** Artwork, synopsis, score and genres for the VF releases matched on AniList. */
async function attachMedia(releases) {
  const ids = [...new Set(releases.filter((r) => !r.media && r.anilistId).map((r) => r.anilistId))];
  if (ids.length === 0) return;
  try {
    const data = await anilist(`query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`, { ids });
    const byId = new Map(data.Page.media.map((m) => [m.id, m]));
    for (const r of releases) if (!r.media && r.anilistId) r.media = byId.get(r.anilistId) ?? null;
  } catch (err) {
    console.warn('⚠️ Détails AniList VF indisponibles :', err.message);
  }
}

function episodeEmbed(r) {
  const m = r.media;
  const animeUrl = m ? `${SAKURA_URL}/anime?id=${m.id}` : SAKURA_URL;
  const number = r.episode ? `Épisode ${r.episode}` : r.label || 'Nouvel épisode';
  const cover = m?.coverImage?.extraLarge || m?.coverImage?.large || r.image || null;
  const banner = m?.bannerImage || cover;
  const score = m?.averageScore ? `${(m.averageScore / 10).toFixed(1)}/10` : null;
  const genres = m?.genres?.length ? m.genres.slice(0, 3).join(', ') : null;
  const synopsis = cleanDescription(m?.description);

  const fields = [
    { name: '📺 Anime', value: `**${r.title}**`, inline: true },
    { name: '🔢 Numéro', value: `**${number}**`, inline: true },
    { name: '🗣️ Version', value: r.lang === 'vf' ? '🇫🇷 VF' : '🇯🇵 VOSTFR', inline: true },
    { name: '⏰ Sortie', value: r.timeKnown ? `${parisTime(r.at)} (heure de Paris)` : 'Aujourd’hui', inline: true },
  ];
  if (score) fields.push({ name: '⭐ Note AniList', value: score, inline: true });
  if (genres) fields.push({ name: '🎭 Genres', value: genres, inline: true });
  fields.push({
    name: '🍿 Regarder',
    value: `[▶️ **Voir sur SAKURA**](${animeUrl}) • [📅 **Calendrier**](${SAKURA_URL}/calendar)`,
    inline: false,
  });

  return {
    title: `🎬 [${r.lang.toUpperCase()}] ${r.title} — ${number}`,
    url: animeUrl,
    description: `Un nouvel épisode de **${r.title}** est disponible sur **SAKURA** !${synopsis ? `\n\n> *« ${synopsis} »*` : ''}`,
    color: m?.coverImage?.color ? parseInt(m.coverImage.color.slice(1), 16) : SAKURA_COLOR,
    fields,
    ...(banner ? { image: { url: banner } } : {}),
    ...(cover ? { thumbnail: { url: cover } } : {}),
    footer: { text: 'SAKURA • Sorties épisodes', icon_url: SAKURA_AVATAR },
    timestamp: new Date(r.at * 1000).toISOString(),
  };
}

function newAnimeEmbed(r) {
  const m = r.media;
  const animeUrl = `${SAKURA_URL}/anime?id=${m.id}`;
  const original = m.title.romaji && m.title.romaji !== r.title ? m.title.romaji : null;
  const synopsis = cleanDescription(m.description);
  const cover = m.coverImage?.extraLarge || m.coverImage?.large || null;
  const fields = [
    { name: '📺 Format', value: m.format || 'TV', inline: true },
    { name: '🎞️ Épisodes', value: m.episodes ? String(m.episodes) : 'En cours', inline: true },
    { name: '⭐ Note', value: m.averageScore ? `${(m.averageScore / 10).toFixed(1)}/10` : 'N/C', inline: true },
  ];
  if (m.genres?.length) fields.push({ name: '🎭 Genres', value: m.genres.slice(0, 4).join(', '), inline: true });
  if (original) fields.push({ name: '🏷️ Titre original', value: original, inline: true });
  fields.push({
    name: '🍿 Regarder',
    value: `[▶️ **Voir sur SAKURA**](${animeUrl}) • [🔍 **Découvrir**](${SAKURA_URL}/discover)`,
    inline: false,
  });
  return {
    title: `🌸 NOUVEL ANIME — ${r.title}`,
    url: animeUrl,
    description: `**${r.title}** commence : l’épisode 1 est disponible en VOSTFR sur **SAKURA** !${synopsis ? `\n\n> *« ${synopsis} »*` : ''}`,
    color: m.coverImage?.color ? parseInt(m.coverImage.color.slice(1), 16) : SAKURA_COLOR,
    fields,
    ...(m.bannerImage || cover ? { image: { url: m.bannerImage || cover } } : {}),
    ...(cover ? { thumbnail: { url: cover } } : {}),
    footer: { text: 'SAKURA • Nouveaux animes', icon_url: SAKURA_AVATAR },
    timestamp: new Date(r.at * 1000).toISOString(),
  };
}

async function announceReleases() {
  const episodesUrl = process.env.DISCORD_WEBHOOK_EPISODES;
  const animesUrl = process.env.DISCORD_WEBHOOK_ANIMES;
  if (!episodesUrl && !DRY_RUN) {
    console.error('❌ DISCORD_WEBHOOK_EPISODES manquant');
    process.exit(1);
  }

  const state = loadState();
  const now = nowS();
  const from = state.lastCheck > 0 ? Math.max(state.lastCheck, now - MAX_WINDOW_S) : now - FIRST_WINDOW_S;
  const seen = new Set(state.announced);
  console.log(`Fenêtre : ${new Date(from * 1000).toISOString()} → ${new Date(now * 1000).toISOString()}`);

  // A source down: keep the window open so its releases are posted on the next run.
  let vostfr, vf;
  try {
    [vostfr, vf] = await Promise.all([fetchVostfr(from, now), fetchVf(from, now)]);
  } catch (err) {
    console.error('❌ Sources indisponibles, nouvel essai au prochain passage :', err.message);
    process.exit(1);
  }

  const releases = [...vostfr, ...vf].filter((r) => !seen.has(r.key)).sort((a, b) => a.at - b.at);
  await attachMedia(releases);
  console.log(`${releases.length} sortie(s) à annoncer (${vostfr.length} VOSTFR, ${vf.length} VF dans la fenêtre)`);

  let posted = 0;
  for (const r of releases.slice(0, MAX_POSTS_PER_RUN)) {
    if (!(await post(episodesUrl, { embeds: [episodeEmbed(r)] }))) break;
    state.announced.push(r.key);
    posted++;
    if (animesUrl && r.lang === 'vostfr' && r.episode === 1 && r.media) {
      await post(animesUrl, { embeds: [newAnimeEmbed(r)] });
    }
    await sleep(1200); // webhook limit: 5 messages / 2 s
  }
  // Whatever wasn't posted (cap, Discord error) is retried next run: only advance when everything went out.
  if (posted === releases.length) state.lastCheck = now;
  saveState(state);
  console.log(`✅ ${posted} message(s) publié(s)`);
}

// ───────── Weekly recap ─────────

/** SAKURA's most watched anime this week (anonymous counts, see supabase weekly_top_anime). */
async function fetchSakuraTop() {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return [];
  try {
    const res = await fetch(`${base}/rest/v1/rpc/weekly_top_anime`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_rows: 5 }),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('⚠️ Top SAKURA indisponible :', err.message);
    return [];
  }
}

async function announceRecap() {
  const url = process.env.DISCORD_WEBHOOK_RECAP || process.env.DISCORD_WEBHOOK_EPISODES;
  if (!url && !DRY_RUN) {
    console.error('❌ DISCORD_WEBHOOK_RECAP (ou DISCORD_WEBHOOK_EPISODES) manquant');
    process.exit(1);
  }
  const now = nowS();
  const from = now - 7 * 86_400;
  let vostfr = [];
  let vf = [];
  try {
    [vostfr, vf] = await Promise.all([fetchVostfr(from, now), fetchVf(from, now).catch(() => [])]);
  } catch (err) {
    console.error('❌ AniList indisponible :', err.message);
    process.exit(1);
  }

  // One line per anime (its latest episode of the week), the most popular first.
  const byAnime = new Map();
  for (const r of vostfr) {
    const prev = byAnime.get(r.media.id);
    if (!prev || r.episode > prev.episode) byAnime.set(r.media.id, r);
  }
  const top = [...byAnime.values()].sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0)).slice(0, 10);
  const medal = (i) => ['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`;
  const topText = top
    .map((r, i) => `${medal(i)} [${r.title}](${SAKURA_URL}/anime?id=${r.media.id}) — ép. ${r.episode}`)
    .join('\n');

  const sakuraTop = await fetchSakuraTop();
  const sakuraText = sakuraTop
    .map((a, i) => `${medal(i)} [${a.title ?? 'Anime'}](${SAKURA_URL}/anime?id=${a.anime_id}) — ${a.viewers} spectateurs`)
    .join('\n');

  const fields = [
    { name: '📊 Cette semaine', value: `**${vostfr.length}** épisodes en VOSTFR • **${vf.length}** en VF`, inline: false },
  ];
  if (topText) fields.push({ name: '🔥 Les sorties les plus suivies', value: topText.slice(0, 1024), inline: false });
  if (sakuraText) fields.push({ name: '🌸 Les plus regardés sur SAKURA', value: sakuraText.slice(0, 1024), inline: false });
  fields.push({
    name: '📅 La semaine prochaine',
    value: `[Voir le calendrier des sorties](${SAKURA_URL}/calendar)`,
    inline: false,
  });

  const banner = top.find((r) => r.media.bannerImage)?.media.bannerImage;
  const ok = await post(url, {
    embeds: [
      {
        title: '🗞️ Le récap de la semaine',
        url: `${SAKURA_URL}/calendar`,
        description: 'Tout ce qui est sorti ces 7 derniers jours sur **SAKURA**.',
        color: SAKURA_COLOR,
        fields,
        ...(banner ? { image: { url: banner } } : {}),
        footer: { text: 'SAKURA • Récap du dimanche', icon_url: SAKURA_AVATAR },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  if (!ok) process.exit(1);
  console.log(`✅ Récap publié (${top.length} sorties, ${sakuraTop.length} au top SAKURA)`);
}

if (action === 'recap') {
  await announceRecap();
} else if (action === 'releases' || action === 'episodes') {
  await announceReleases();
} else {
  await announceChangelog();
}
