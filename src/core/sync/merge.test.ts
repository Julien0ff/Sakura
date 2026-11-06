import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRows, type Row } from './merge.ts';

const r = (key: string, value: string | null, updatedAt: number): Row<string> => ({ key, value, updatedAt });

test('merge: empty remote keeps all local and marks them dirty', () => {
  const local = [r('a', 'A', 1), r('b', 'B', 2)];
  const { merged, toPush } = mergeRows(local, []);
  assert.deepEqual(merged, local);
  assert.deepEqual(toPush, local);
});

test('merge: newer remote wins', () => {
  const { merged, toPush } = mergeRows([r('a', 'old', 1)], [r('a', 'new', 5)]);
  assert.deepEqual(merged, [r('a', 'new', 5)]);
  assert.deepEqual(toPush, []);
});

test('merge: re-add after tombstone wins', () => {
  const { merged, toPush } = mergeRows([r('a', null, 10)], [r('a', 'X', 20)]);
  assert.deepEqual(merged, [r('a', 'X', 20)]);
  assert.deepEqual(toPush, []);
});

test('merge: tombstone newer than remote deletes', () => {
  const { merged, toPush } = mergeRows([r('a', null, 30)], [r('a', 'X', 20)]);
  assert.deepEqual(merged, [r('a', null, 30)]);
  assert.deepEqual(toPush, [r('a', null, 30)]);
});

test('merge: tie prefers remote', () => {
  const { merged, toPush } = mergeRows([r('a', 'L', 7)], [r('a', 'R', 7)]);
  assert.deepEqual(merged, [r('a', 'R', 7)]);
  assert.deepEqual(toPush, []);
});

test('merge: remote-only rows are kept and not pushed', () => {
  const { merged, toPush } = mergeRows([], [r('z', 'Z', 3)]);
  assert.deepEqual(merged, [r('z', 'Z', 3)]);
  assert.deepEqual(toPush, []);
});
