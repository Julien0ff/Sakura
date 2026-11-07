import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localRows, snapshotFromRows, watchlistToDb, watchlistFromDb, episodeRatingToDb, episodeRatingFromDb } from './mappers.ts';
import type { SyncSnapshot } from '../store.ts';

const base: SyncSnapshot = {
  watchlist: [{ id: 1, title: 'A', cover: 'a', updatedAt: 100, listStatus: 'planned' }],
  history: [{ id: 2, title: 'B', cover: 'b', episodeNumber: 3, episodeName: 'E3', season: 1, lang: 'vf', watchedAt: 200 }],
  progress: { '2:1:3': { time: 5, duration: 50, updatedAt: 210 } },
  episodeRatings: { '2:1:3': { rating: 8, updatedAt: 220 } },
  deleted: { 'w:9': 300, 'h:8': 310, 'r:2:1:4': 320 },
  settings: { defaultLang: 'vf', autoSkip: false, autoNext: true, haptics: true, hapticIntensity: 'normal', episodeView: 'auto', calendarLang: 'all' },
  settingsUpdatedAt: 0,
};

test('mappers: local rows include tombstones as null values', () => {
  const rows = localRows(base);
  assert.deepEqual(rows.watchlist.map((r) => [r.key, r.value === null, r.updatedAt]), [['w:1', false, 100], ['w:9', true, 300]]);
  assert.deepEqual(rows.history.map((r) => [r.key, r.value === null, r.updatedAt]), [['h:2', false, 200], ['h:8', true, 310]]);
  assert.deepEqual(rows.progress.map((r) => [r.key, r.updatedAt]), [['p:2:1:3', 210]]);
});

test('mappers: watchlist row round-trips through the DB shape', () => {
  const [row] = localRows(base).watchlist;
  const db = watchlistToDb(row);
  assert.equal(db.anime_id, 1);
  assert.equal(db.deleted_at, null);
  assert.equal(db.updated_at, new Date(100).toISOString());
  assert.deepEqual(watchlistFromDb({ ...db, user_id: 'u', added_at: db.updated_at, synced_at: db.updated_at, color: null, score: null, status: null, rating: null, completed_on_sakura_at: null, favorite: false } as never), row);
});

test('mappers: tombstone maps to deleted_at and back to null', () => {
  const tomb = localRows(base).watchlist[1];
  const db = watchlistToDb(tomb);
  assert.equal(db.anime_id, 9);
  assert.equal(db.deleted_at, new Date(300).toISOString());
  assert.equal(watchlistFromDb({ ...db, user_id: 'u', added_at: db.updated_at, synced_at: db.updated_at } as never).value, null);
});

test('mappers: snapshot rebuilds sorted lists, tombstones and keeps settings', () => {
  const rows = localRows(base);
  const snap = snapshotFromRows(
    {
      watchlist: [...rows.watchlist, { key: 'w:5', value: { id: 5, title: 'E', cover: 'e', updatedAt: 500, listStatus: 'watching' as const }, updatedAt: 500 }],
      history: rows.history,
      progress: rows.progress,
      episodeRatings: rows.episodeRatings,
    },
    base.settings,
    7
  );
  assert.deepEqual(snap.watchlist.map((a) => a.id), [5, 1]);
  assert.deepEqual(snap.deleted, { 'w:9': 300, 'h:8': 310, 'r:2:1:4': 320 });
  assert.deepEqual(snap.episodeRatings, base.episodeRatings);
  assert.deepEqual(snap.progress, base.progress);
  assert.equal(snap.settingsUpdatedAt, 7);
});

test('mappers: watchlist round-trips status, rating, favorite, completedOnSakuraAt', () => {
  const row = { key: 'w:7', value: { id: 7, title: 'G', cover: 'g', updatedAt: 700, listStatus: 'completed' as const, rating: 9, favorite: true, completedOnSakuraAt: 650 }, updatedAt: 700 };
  const db = watchlistToDb(row);
  assert.equal(db.list_status, 'completed');
  assert.equal(db.rating, 9);
  assert.equal(db.favorite, true);
  assert.equal(db.completed_on_sakura_at, new Date(650).toISOString());
  assert.deepEqual(watchlistFromDb({ ...db, user_id: 'u', added_at: db.updated_at, synced_at: db.updated_at, color: null, score: null, status: null } as never), row);
});

test('mappers: episode rating tombstone maps to deleted_at', () => {
  const rows = localRows(base).episodeRatings;
  assert.deepEqual(rows.map((r) => [r.key, r.value === null]), [['r:2:1:3', false], ['r:2:1:4', true]]);
  const tomb = episodeRatingToDb(rows[1]);
  assert.deepEqual([tomb.anime_id, tomb.season, tomb.episode, tomb.rating, tomb.deleted_at], [2, 1, 4, null, new Date(320).toISOString()]);
  const live = episodeRatingToDb(rows[0]);
  assert.equal(live.rating, 8);
  assert.deepEqual(episodeRatingFromDb({ ...live, user_id: 'u', synced_at: live.updated_at } as never), rows[0]);
});
