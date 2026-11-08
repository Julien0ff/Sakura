import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnimeQuery } from './admin.ts';

test('parseAnimeQuery: an AniList id', () => {
  assert.deepEqual(parseAnimeQuery(' 21 '), { id: 21 });
});

test('parseAnimeQuery: an AniList or SAKURA link', () => {
  assert.deepEqual(parseAnimeQuery('https://anilist.co/anime/16498/Shingeki-no-Kyojin/'), { id: 16498 });
  assert.deepEqual(parseAnimeQuery('https://sakura.thefoxy.me/anime?id=21&s=1'), { id: 21 });
});

test('parseAnimeQuery: anything else is a title search; blank is nothing', () => {
  assert.deepEqual(parseAnimeQuery('  Frieren '), { search: 'Frieren' });
  assert.deepEqual(parseAnimeQuery('86'), { id: 86 });
  assert.equal(parseAnimeQuery('   '), null);
  assert.deepEqual(parseAnimeQuery('0'), { search: '0' });
});
