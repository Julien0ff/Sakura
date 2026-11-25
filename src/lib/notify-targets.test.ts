import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterQuietHours, inQuietHours, notifyTargets } from './notify-targets.ts';

const list = [
  { id: 1, title: 'Blue Box', listStatus: 'watching' as const },
  { id: 2, title: 'Frieren', listStatus: 'planned' as const },
  { id: 3, title: 'Naruto', listStatus: 'completed' as const },
  { id: 4, title: 'Bleach', listStatus: 'paused' as const },
  { id: 5, title: 'One Piece', listStatus: 'dropped' as const },
];

test('only « En cours » and « À voir » are followed', () => {
  assert.deepEqual(notifyTargets(list, { enabled: true, lang: 'all', defaultLang: 'vostfr' }).anime.map((a) => a.id), [1, 2]);
});

test('auto: each anime in the language it is watched in, both when not started', () => {
  const t = notifyTargets(list, { enabled: true, lang: 'auto', defaultLang: 'vf', watchedLang: new Map([[1, 'vostfr' as const]]) });
  assert.deepEqual(t.anime.map((a) => [a.id, a.langs]), [[1, ['vostfr']], [2, ['vostfr', 'vf']]]);
  assert.deepEqual(t.langs, ['vostfr', 'vf']);
  const vfOnly = notifyTargets(list, { enabled: true, lang: 'auto', defaultLang: 'vostfr', watchedLang: new Map([[1, 'vf' as const], [2, 'vf' as const]]) });
  assert.deepEqual(vfOnly.langs, ['vf']);
});

test('fixed languages apply to every anime', () => {
  assert.equal(notifyTargets(list, { enabled: true, lang: 'vf', defaultLang: 'vf' }).anime[0].langs, undefined);
  assert.deepEqual(notifyTargets(list, { enabled: true, lang: 'all', defaultLang: 'vf' }).langs, ['vostfr', 'vf']);
  assert.deepEqual(notifyTargets(list, { enabled: true, lang: 'vostfr', defaultLang: 'vf' }).langs, ['vostfr']);
});

test('disabled: nothing followed', () => {
  assert.deepEqual(notifyTargets(list, { enabled: false, lang: 'all', defaultLang: 'vf' }), { anime: [], langs: [], quiet: null });
});

test('« Prévenez-moi » anime are added once', () => {
  const t = notifyTargets(list, { enabled: true, lang: 'all', defaultLang: 'vf', extra: [{ id: 9, title: 'Dandadan' }, { id: 1, title: 'Blue Box' }] });
  assert.deepEqual(t.anime.map((a) => a.id), [1, 2, 9]);
});

test('quiet hours: off, invalid or empty window → null', () => {
  const base = { enabled: true, lang: 'all' as const, defaultLang: 'vf' as const };
  assert.equal(notifyTargets(list, { ...base, quietHours: { enabled: false, start: '23:00', end: '08:00' } }).quiet, null);
  assert.equal(notifyTargets(list, { ...base, quietHours: { enabled: true, start: '25:00', end: '08:00' } }).quiet, null);
  assert.equal(notifyTargets(list, { ...base, quietHours: { enabled: true, start: '08:00', end: '08:00' } }).quiet, null);
  assert.deepEqual(notifyTargets(list, { ...base, quietHours: { enabled: true, start: '23:00', end: '08:00' }, utcOffset: 60 }).quiet, { start: 1380, end: 480, utcOffset: 60 });
});

test('quiet hours across midnight (Paris winter, UTC+1)', () => {
  const q = { start: 23 * 60, end: 8 * 60, utcOffset: 60 };
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 20, h - 1, m) / 1000; // Paris wall clock → epoch
  assert.equal(inQuietHours(at(22, 59), q), false);
  assert.equal(inQuietHours(at(23, 0), q), true);
  assert.equal(inQuietHours(at(3, 30), q), true);
  assert.equal(inQuietHours(at(8, 0), q), false);
  // 03:30 → 08:00 the same morning; 12:00 is untouched.
  assert.equal(afterQuietHours(at(3, 30), q), at(8, 0));
  assert.equal(afterQuietHours(at(12, 0), q), at(12, 0));
  // 23:30 → 08:00 the next morning.
  assert.equal(afterQuietHours(at(23, 30), q), at(23, 30) + (8 * 60 + 30) * 60);
});

test('quiet hours within a day (13:00 → 14:00)', () => {
  const q = { start: 13 * 60, end: 14 * 60, utcOffset: 0 };
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 20, h, m) / 1000;
  assert.equal(inQuietHours(at(13, 15), q), true);
  assert.equal(inQuietHours(at(14, 0), q), false);
  assert.equal(afterQuietHours(at(13, 15), q), at(14, 0));
});
