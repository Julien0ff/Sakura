import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchingSeason, isListedSeason, showTitle, pickShow, openingSeason, extraEntries } from './seasons.ts';

// TMDB « Assassination Classroom »: one show, two seasons.
const seasons = [
  { season_number: 1, air_date: '2015-01-10' },
  { season_number: 2, air_date: '2016-01-08' },
];

test('matchingSeason: the TMDB season that started with the AniList entry', () => {
  assert.equal(matchingSeason(seasons, { year: 2015, month: 1, day: 10 }), 1);
  assert.equal(matchingSeason(seasons, { year: 2016, month: 1, day: 8 }), 2);
  // A few weeks apart (different time zones / pre-airing) still matches.
  assert.equal(matchingSeason(seasons, { year: 2015, month: 12, day: 20 }), 2);
});

test('matchingSeason: none for a date far from every season, or unknown dates', () => {
  assert.equal(matchingSeason(seasons, { year: 2016, month: 7, day: 1 }), null);
  assert.equal(matchingSeason(seasons, { year: null }), null);
  assert.equal(matchingSeason([{ season_number: 1 }], { year: 2015, month: 1, day: 10 }), null);
});

test('isListedSeason: a TV sequel already shown as a season of the page is hidden from relations', () => {
  const s2 = { relationType: 'SEQUEL', node: { format: 'TV', startDate: { year: 2016, month: 1, day: 8 } } };
  assert.equal(isListedSeason(s2, seasons), true);
  // The movie, a sequel airing outside TMDB's seasons, or a show with one season: kept.
  assert.equal(isListedSeason({ ...s2, node: { ...s2.node, format: 'MOVIE' } }, seasons), false);
  assert.equal(isListedSeason({ ...s2, node: { ...s2.node, startDate: { year: 2019, month: 4, day: 1 } } }, seasons), false);
  assert.equal(isListedSeason({ ...s2, relationType: 'SIDE_STORY' }, seasons), false);
  assert.equal(isListedSeason(s2, seasons.slice(0, 1)), false);
});

test('showTitle: AniList season titles → the show title TMDB knows', () => {
  assert.equal(showTitle('Assassination Classroom Second Season'), 'Assassination Classroom');
  assert.equal(showTitle('Attack on Titan Season 3 Part 2'), 'Attack on Titan');
  assert.equal(showTitle('Attack on Titan Final Season'), 'Attack on Titan');
  assert.equal(showTitle('Re:ZERO -Starting Life in Another World- Season 2'), 'Re:ZERO -Starting Life in Another World-');
  assert.equal(showTitle('Mob Psycho 100 II'), 'Mob Psycho 100');
  assert.equal(showTitle('Kaguya-sama: Love is War 2nd Season'), 'Kaguya-sama: Love is War');
  assert.equal(showTitle('Spy x Family Part 2'), 'Spy x Family');
  // Nothing to strip.
  assert.equal(showTitle('Frieren: Beyond Journey’s End'), 'Frieren: Beyond Journey’s End');
  assert.equal(showTitle('Season'), 'Season');
});

test('pickShow: exact title first, else the most voted Japanese show', () => {
  const aot = [
    { id: 340609, name: 'Attack on Titan - Specials', original_language: 'es', vote_count: 0 },
    { id: 224499, name: 'ちみキャラ劇場', original_language: 'ja', vote_count: 5 },
    { id: 63510, name: "L'Attaque des Titans - Junior High School", original_language: 'ja', vote_count: 220 },
    { id: 1429, name: "L'Attaque des Titans", original_name: '進撃の巨人', original_language: 'ja', vote_count: 7808 },
  ];
  assert.equal(pickShow(aot, 'Attack on Titan')?.id, 1429);
  const naruto = [
    { id: 46260, name: 'Naruto', original_language: 'ja', vote_count: 6183 },
    { id: 31910, name: 'Naruto Shippuden', original_language: 'ja', vote_count: 8841 },
  ];
  assert.equal(pickShow(naruto, 'NARUTO')?.id, 46260);
  // No Japanese result: the first one (as before); nothing: null.
  assert.equal(pickShow([{ id: 7, name: 'X', original_language: 'en' }], 'X')?.id, 7);
  assert.equal(pickShow([], 'X'), null);
});

test('openingSeason: a later part of a season opens on that season', () => {
  const aot = [
    { season_number: 1, air_date: '2013-04-07' },
    { season_number: 2, air_date: '2017-04-01' },
    { season_number: 3, air_date: '2018-07-23' },
    { season_number: 4, air_date: '2020-12-07' },
  ];
  assert.equal(openingSeason(aot, { year: 2019, month: 4, day: 29 }), 3); // Season 3 Part 2
  assert.equal(openingSeason(aot, { year: 2020, month: 12, day: 7 }), 4);
  assert.equal(openingSeason(aot, { year: 2022, month: 1, day: 10 }), 4); // Final Season Part 2
  // Long after the last season TMDB knows (a new season TMDB lacks): season 1, as before.
  assert.equal(openingSeason(aot, { year: 2025, month: 1, day: 1 }), 1);
  assert.equal(openingSeason(aot, null), 1);
});

const rel = (relationType: string, id: number, format: string, year: number, month = 1, type = 'ANIME') => ({
  relationType,
  node: { id, type, format, title: { romaji: `R${id}`, english: `E${id}` }, startDate: { year, month, day: 1 } },
});

test('extraEntries: films, then OVAs, then specials of the show, each by date', () => {
  const edges = [
    rel('SIDE_STORY', 3, 'OVA', 2017),
    rel('SEQUEL', 2, 'TV', 2016),
    rel('SIDE_STORY', 4, 'MOVIE', 2016, 11),
    rel('SUMMARY', 5, 'SPECIAL', 2015, 6),
  ];
  assert.deepEqual(
    extraEntries(edges).map((e) => [e.id, e.label, e.title]),
    [[4, 'Film', 'E4'], [3, 'OVA', 'E3'], [5, 'Spécial', 'E5']]
  );
});

test('extraEntries: several of a kind are numbered; spin-offs, music, manga and characters left out', () => {
  const edges = [
    rel('SEQUEL', 7, 'MOVIE', 2020),
    rel('PREQUEL', 6, 'MOVIE', 2018),
    rel('SPIN_OFF', 8, 'MOVIE', 2019),
    rel('OTHER', 9, 'MUSIC', 2019),
    rel('CHARACTER', 10, 'MOVIE', 2019),
    rel('SIDE_STORY', 11, 'MOVIE', 2019, 1, 'MANGA'),
  ];
  assert.deepEqual(extraEntries(edges).map((e) => [e.id, e.label]), [[6, 'Film 1'], [7, 'Film 2']]);
  assert.deepEqual(extraEntries(undefined), []);
});
