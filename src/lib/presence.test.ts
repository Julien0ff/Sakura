import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPresence, type PresenceInput } from './presence.ts';

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
