import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyTargets } from './notify-targets.ts';

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

test('auto language follows the default language', () => {
  assert.deepEqual(notifyTargets(list, { enabled: true, lang: 'auto', defaultLang: 'vf' }).langs, ['vf']);
  assert.deepEqual(notifyTargets(list, { enabled: true, lang: 'all', defaultLang: 'vf' }).langs, ['vostfr', 'vf']);
  assert.deepEqual(notifyTargets(list, { enabled: true, lang: 'vostfr', defaultLang: 'vf' }).langs, ['vostfr']);
});

test('disabled: nothing followed', () => {
  assert.deepEqual(notifyTargets(list, { enabled: false, lang: 'all', defaultLang: 'vf' }), { anime: [], langs: [] });
});
