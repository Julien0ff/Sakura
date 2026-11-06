import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BLOCKS, isFinalEpisode, nextStatusOnWatched, normalizeBlocks } from './tracking.ts';
import { isTrophy } from '../lib/trophies.ts';

test('autoComplete: releasing anime never completes', () => {
  assert.equal(isFinalEpisode({ anilistStatus: 'RELEASING', tmdbSeasons: [{ season_number: 1, episode_count: 12 }], season: 1, episode: 12 }), false);
});

test('autoComplete: last episode of last season', () => {
  const tmdbSeasons = [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 13 }];
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons, season: 2, episode: 13 }), true);
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons, season: 1, episode: 12 }), false);
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons, season: 2, episode: 12 }), false);
});

test('autoComplete: specials season is ignored', () => {
  const tmdbSeasons = [{ season_number: 0, episode_count: 5 }, { season_number: 1, episode_count: 12 }];
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons, season: 1, episode: 12 }), true);
});

test('autoComplete: no tmdb seasons uses anilist episodes', () => {
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons: [], anilistEpisodes: 24, season: 1, episode: 24 }), true);
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons: [], anilistEpisodes: 24, season: 1, episode: 23 }), false);
  assert.equal(isFinalEpisode({ anilistStatus: 'FINISHED', tmdbSeasons: [], anilistEpisodes: null, season: 1, episode: 1 }), false);
});

test('nextStatusOnWatched keeps completed', () => {
  assert.equal(nextStatusOnWatched('completed'), 'completed');
  assert.equal(nextStatusOnWatched('dropped'), 'dropped');
  assert.equal(nextStatusOnWatched('watching'), 'watching');
  assert.equal(nextStatusOnWatched(null), 'watching');
  assert.equal(nextStatusOnWatched('planned'), 'watching');
  assert.equal(nextStatusOnWatched('paused'), 'watching');
});

test('normalizeBlocks repairs input', () => {
  const out = normalizeBlocks([{ id: 'planned', visible: true }, { id: 'bogus', visible: true }]);
  assert.deepEqual(out[0], { id: 'planned', visible: true });
  assert.equal(out.length, 7);
  assert.ok(!out.some((b) => (b.id as string) === 'bogus'));
  assert.deepEqual(out.slice(1).map((b) => b.id), DEFAULT_BLOCKS.filter((b) => b.id !== 'planned').map((b) => b.id));
  assert.deepEqual(normalizeBlocks('garbage'), DEFAULT_BLOCKS);
  assert.deepEqual(normalizeBlocks({ blocks: [{ id: 'stats', visible: false }] })[0], { id: 'stats', visible: false });
});

test('isTrophy threshold and overrides', () => {
  assert.equal(isTrophy(1, 150000), true);
  assert.equal(isTrophy(1, 149999), false);
  assert.equal(isTrophy(1, null), false);
});
