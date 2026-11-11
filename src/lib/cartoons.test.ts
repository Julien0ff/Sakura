import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartoonId, isCartoonId, tmdbIdOf, isCartoon, cartoonSummary, cartoonStatus, cartoonMedia, discoverQuery } from './cartoons.ts';

const gumball = {
  id: 37606,
  name: 'Le Monde incroyable de Gumball',
  original_name: 'The Amazing World of Gumball',
  original_language: 'en',
  origin_country: ['GB', 'US'],
  genre_ids: [16, 35],
  poster_path: '/gumball.jpg',
  backdrop_path: '/gumball-bg.jpg',
  overview: 'Gumball…',
  vote_average: 8.24,
  first_air_date: '2011-05-03',
};

test('cartoon ids: a TMDB id becomes a negative id, and back', () => {
  assert.equal(cartoonId(37606), -37606);
  assert.equal(tmdbIdOf(-37606), 37606);
  assert.equal(isCartoonId(-1), true);
  assert.equal(isCartoonId(5), false);
});

test('isCartoon: animated, not Japanese / Korean / Chinese (those come from AniList)', () => {
  assert.equal(isCartoon(gumball), true);
  assert.equal(isCartoon({ ...gumball, origin_country: ['JP'], original_language: 'ja' }), false);
  assert.equal(isCartoon({ ...gumball, original_language: 'ko', origin_country: ['KR'] }), false);
  assert.equal(isCartoon({ ...gumball, genre_ids: [35] }), false);
});

test('cartoonSummary: a card like an AniList entry', () => {
  const s = cartoonSummary(gumball);
  assert.equal(s.id, -37606);
  assert.equal(s.title.english, 'Le Monde incroyable de Gumball');
  assert.equal(s.title.romaji, 'The Amazing World of Gumball');
  assert.equal(s.coverImage.extraLarge, 'https://image.tmdb.org/t/p/w500/gumball.jpg');
  assert.equal(s.averageScore, 82);
  assert.equal(s.format, 'TV');
  assert.equal(s.seasonYear, 2011);
  assert.equal(cartoonSummary({ ...gumball, poster_path: null }).coverImage.extraLarge, null);
});

test('cartoonStatus: TMDB status → AniList status', () => {
  assert.equal(cartoonStatus('Returning Series'), 'RELEASING');
  assert.equal(cartoonStatus('Ended'), 'FINISHED');
  assert.equal(cartoonStatus('Canceled'), 'CANCELLED');
  assert.equal(cartoonStatus('In Production'), 'NOT_YET_RELEASED');
});

test('cartoonMedia: the anime page shape, seasons without specials, no AniList extras', () => {
  const m = cartoonMedia({
    ...gumball,
    status: 'Ended',
    number_of_episodes: 240,
    genres: [{ id: 16, name: 'Animation' }, { id: 35, name: 'Comédie' }],
    networks: [{ name: 'Cartoon Network' }],
    seasons: [
      { season_number: 0, name: 'Épisodes spéciaux', air_date: null },
      { season_number: 1, name: 'Saison 1', air_date: '2011-05-03' },
    ],
    external_ids: { imdb_id: 'tt1942683' },
  });
  assert.equal(m.id, -37606);
  assert.equal(m.tmdbId, 37606);
  assert.equal(m.tmdbTitle, 'Le Monde incroyable de Gumball');
  assert.deepEqual(m.tmdbSeasons.map((s) => s.season_number), [1]);
  assert.equal(m.status, 'FINISHED');
  assert.equal(m.episodes, 240);
  assert.deepEqual(m.genres, ['Animation', 'Comédie']);
  assert.deepEqual(m.studios.nodes, [{ name: 'Cartoon Network' }]);
  assert.deepEqual(m.relations.edges, []);
  assert.equal(m.idMal, null);
  assert.equal(m.imdbId, 'tt1942683');
  assert.deepEqual(m.startDate, { year: 2011, month: 5, day: 3 });
  assert.equal(m.bannerImage, 'https://image.tmdb.org/t/p/w1280/gumball-bg.jpg');
});

test('discoverQuery: animated shows outside Asia, sorted like Découvrir', () => {
  const q = new URLSearchParams(discoverQuery('SCORE_DESC', 2));
  assert.equal(q.get('with_genres'), '16');
  assert.equal(q.get('sort_by'), 'vote_average.desc');
  assert.equal(q.get('vote_count.gte'), '200');
  assert.equal(q.get('page'), '2');
  assert.equal(q.get('language'), 'fr-FR');
  assert.equal(new URLSearchParams(discoverQuery('POPULARITY_DESC', 1)).get('sort_by'), 'popularity.desc');
  const recent = new URLSearchParams(discoverQuery('START_DATE_DESC', 1));
  assert.equal(recent.get('sort_by'), 'first_air_date.desc');
  // Not the dozens of unknown shows of the day: a few votes at least.
  assert.equal(recent.get('vote_count.gte'), '20');
});
