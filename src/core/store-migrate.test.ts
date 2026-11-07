import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateStore } from './store-migrate.ts';

test('migrate v4→v5 sets planned and episodeRatings', () => {
  const out = migrateStore(
    { watchlist: [{ id: 1, title: 'A', cover: 'a', updatedAt: 5 }], history: [], progress: {}, deleted: {}, settings: { defaultLang: 'vf' }, settingsUpdatedAt: 3 },
    4
  );
  assert.equal(out.watchlist[0].listStatus, 'planned');
  assert.equal(out.watchlist[0].updatedAt, 5);
  assert.deepEqual(out.episodeRatings, {});
  assert.equal(out.settings.defaultLang, 'vf');
  assert.equal(out.settings.autoNext, true);
  assert.equal(out.settings.episodeView, 'auto');
  assert.equal(out.settings.calendarLang, 'all');
  assert.equal(out.settingsUpdatedAt, 3);
});

test('migrate v3→v5 adds updatedAt, deleted and status', () => {
  const out = migrateStore({ watchlist: [{ id: 2, title: 'B', cover: 'b' }], progress: undefined }, 3);
  assert.equal(out.watchlist[0].listStatus, 'planned');
  assert.ok(out.watchlist[0].updatedAt > 0);
  assert.deepEqual(out.deleted, {});
  assert.deepEqual(out.progress, {});
  assert.deepEqual(out.history, []);
});

test('migrate keeps a valid existing status', () => {
  const out = migrateStore({ watchlist: [{ id: 3, title: 'C', cover: 'c', updatedAt: 1, listStatus: 'completed' }] }, 5);
  assert.equal(out.watchlist[0].listStatus, 'completed');
});

test('migrate v6→v7 adds calendarLang and keeps a chosen one', () => {
  assert.equal(migrateStore({ settings: { defaultLang: 'vf', episodeView: 'list' } }, 6).settings.calendarLang, 'all');
  assert.equal(migrateStore({ settings: { calendarLang: 'vf' } }, 7).settings.calendarLang, 'vf');
});
