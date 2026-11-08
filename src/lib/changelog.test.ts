import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changelogDue } from './changelog.ts';

const base = { welcomed: true, seenId: 'n1', latestId: 'n1' };

test('changelogDue: new notes on the site, not for first-time visitors', () => {
  assert.equal(changelogDue({ ...base, seenId: 'n0' }), true);
  assert.equal(changelogDue(base), false);
  assert.equal(changelogDue({ ...base, welcomed: false, seenId: null }), false);
});

test('changelogDue: mobile app updated since the last launch', () => {
  assert.equal(changelogDue({ ...base, app: { version: '0.5.2', seen: '0.5.1' } }), true);
  assert.equal(changelogDue({ ...base, app: { version: '0.5.2', seen: '0.5.2' } }), false);
  // Updated from a version that did not record it yet.
  assert.equal(changelogDue({ ...base, app: { version: '0.5.2', seen: null } }), true);
  // Fresh install: the welcome popup instead.
  assert.equal(changelogDue({ ...base, welcomed: false, seenId: null, app: { version: '0.5.2', seen: null } }), false);
});
