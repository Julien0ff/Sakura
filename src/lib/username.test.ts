import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, suggestUsername, usernameProblem } from './username.ts';

test('username: normalize strips and lowercases', () => {
  assert.equal(normalizeUsername('Foxy Dev!'), 'foxy_dev');
  assert.equal(normalizeUsername('A'.repeat(30)).length, 20);
  assert.equal(normalizeUsername('Élé-na  '), 'ele_na');
});

test('username: suggestion from provider metadata', () => {
  assert.equal(suggestUsername({ user_name: 'Foxy' }), 'foxy');
  assert.equal(suggestUsername({ full_name: 'Jean Dupont' }), 'jean_dupont');
  assert.equal(suggestUsername({ email: 'zo@x.fr' }), 'zo_sakura');
  assert.equal(suggestUsername({}), '');
});

test('username: problems', () => {
  assert.equal(usernameProblem('ab'), 'Au moins 3 caractères.');
  assert.equal(usernameProblem('admin'), 'Ce pseudo est réservé.');
  assert.equal(usernameProblem('foxy'), null);
});
