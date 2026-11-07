import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowsingPresence, buildPresence, pickPresence, samePresence, type PresenceInput } from './presence.ts';

const base: PresenceInput = {
  animeId: 1535,
  title: 'Death Note',
  cover: 'https://s4.anilist.co/cover.jpg',
  season: 1,
  multiSeason: false,
  episode: 12,
  lang: 'vostfr',
  playing: true,
  time: 60,
  duration: 1400,
  now: 1_800_000_000_000,
  origin: 'https://sakura.thefoxy.me',
};

test('playing: details, state, images, button and time bar', () => {
  const p = buildPresence(base);
  assert.equal(p.details, 'Death Note');
  assert.equal(p.state, 'Épisode 12 · VOSTFR');
  assert.equal(p.large_image, base.cover);
  assert.equal(p.small_image, 'https://sakura.thefoxy.me/icon.png');
  assert.equal(p.start, 1_800_000_000 - 60);
  assert.equal(p.end, 1_800_000_000 - 60 + 1400);
  assert.equal(p.button_label, 'Regarder sur SAKURA');
  assert.equal(p.button_url, 'https://sakura.thefoxy.me/anime?id=1535');
});

test('multi-season shows the season', () => {
  assert.equal(buildPresence({ ...base, multiSeason: true, season: 2, lang: 'vf' }).state, 'Saison 2 · Épisode 12 · VF');
});

test('paused: no time bar, state says paused', () => {
  const p = buildPresence({ ...base, playing: false });
  assert.equal(p.state, 'En pause · Épisode 12 · VOSTFR');
  assert.equal(p.start, undefined);
  assert.equal(p.end, undefined);
});

test('unknown duration (embedded player): no time bar', () => {
  const p = buildPresence({ ...base, duration: 0 });
  assert.equal(p.start, undefined);
  assert.equal(p.end, undefined);
});

test('Discord length limits: 2 to 128 characters', () => {
  assert.equal(buildPresence({ ...base, title: 'x'.repeat(200) }).details.length, 128);
  assert.equal(buildPresence({ ...base, title: 'K' }).details, 'K ');
});

test('browsing: page label, app name in the status, elapsed time since the session start', () => {
  const p = buildBrowsingPresence({ path: '/calendar', since: 1_800_000_000_000, origin: 'https://sakura.thefoxy.me' });
  assert.equal(p.details, 'Calendrier');
  assert.equal(p.state, 'Consulte les prochaines sorties');
  assert.equal(p.display, 'name');
  assert.equal(p.start, 1_800_000_000);
  assert.equal(p.end, undefined);
  assert.equal(p.large_image, 'https://sakura.thefoxy.me/icon.png');
  assert.equal(p.button_url, 'https://sakura.thefoxy.me');
});

test('browsing an anime page shows the anime and links to it', () => {
  const p = buildBrowsingPresence({
    path: '/anime', since: 0, origin: 'https://sakura.thefoxy.me',
    anime: { id: 1535, title: 'Death Note', cover: 'https://s4.anilist.co/c.jpg' },
  });
  assert.equal(p.details, 'Death Note');
  assert.equal(p.state, 'Consulte la fiche');
  assert.equal(p.large_image, 'https://s4.anilist.co/c.jpg');
  assert.equal(p.button_url, 'https://sakura.thefoxy.me/anime?id=1535');
  assert.equal(p.start, undefined); // since 0 = unknown
});

test('unknown paths fall back to a generic label; profiles are recognised', () => {
  assert.equal(buildBrowsingPresence({ path: '/foxy', since: 0, origin: 'o' }).state, 'Regarde un profil');
  assert.equal(buildBrowsingPresence({ path: '/legal/cgu', since: 0, origin: 'o' }).details, 'Sur SAKURA');
});

test('playback outranks browsing', () => {
  const page = buildBrowsingPresence({ path: '/', since: 0, origin: 'o' });
  const play = buildPresence(base);
  assert.equal(pickPresence(page, play), play);
  assert.equal(pickPresence(page, null), page);
  assert.equal(pickPresence(null, null), null);
});

test('watching shows the anime in the status line', () => {
  assert.equal(buildPresence(base).display, 'details');
});

test('samePresence ignores small time drift but not a seek, a pause or another anime', () => {
  const a = buildPresence(base);
  assert.equal(samePresence(a, buildPresence({ ...base, time: base.time + 5, now: base.now + 5000 })), true);
  assert.equal(samePresence(a, buildPresence({ ...base, time: base.time + 120 })), false);
  assert.equal(samePresence(a, buildPresence({ ...base, playing: false })), false);
  assert.equal(samePresence(a, buildPresence({ ...base, title: 'Bleach' })), false);
  assert.equal(samePresence(null, null), true);
  assert.equal(samePresence(a, null), false);
});

test('embedded player: estimated length gives a progress bar from when the player opened', () => {
  const p = buildPresence({ ...base, duration: 0, time: 0, estimatedLength: 1440, openedAt: 1_799_999_700_000 });
  assert.equal(p.start, 1_799_999_700);
  assert.equal(p.end, 1_799_999_700 + 1440);
  // A real duration wins over the estimate.
  assert.equal(buildPresence({ ...base, estimatedLength: 9999, openedAt: 1 }).end, 1_800_000_000 - 60 + 1400);
  // Paused: still no bar.
  assert.equal(buildPresence({ ...base, playing: false, duration: 0, estimatedLength: 1440, openedAt: 1 }).end, undefined);
});
