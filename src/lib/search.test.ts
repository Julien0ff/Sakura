import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTokens, matchScore, mergeSearchResults, needsFallback } from './search.ts';

const a = (id: number, english: string | null, romaji = '') => ({ id, title: { english, romaji } });

test('searchTokens: lowercase, no accents, words of 3+ letters, longest first', () => {
  assert.deepEqual(searchTokens("L'Attaque des Titans"), ['attaque', 'titans', 'des']);
  assert.deepEqual(searchTokens('  Été à   '), ['ete']);
  assert.deepEqual(searchTokens('assassin class'), ['assassin', 'class']);
});

test('matchScore: query words that start a word of the title', () => {
  assert.equal(matchScore(['assassin', 'class'], a(1, 'Assassination Classroom')), 2);
  assert.equal(matchScore(['assassin', 'class'], a(2, 'Akame ga Kill!', 'Akame ga Kill!')), 0);
  assert.equal(matchScore(['frieren'], a(3, null, 'Sousou no Frieren')), 1);
});

test('mergeSearchResults: AniList order first, then the extras that match, without duplicates', () => {
  const primary = [a(1, 'Assassination Classroom')];
  const byWord = [a(1, 'Assassination Classroom'), a(5, 'Akame ga Kill!'), a(2, 'Assassination Classroom Second Season')];
  const byFrenchTitle = [a(9, 'Attack on Titan')];
  assert.deepEqual(
    mergeSearchResults('assassin class', primary, byWord, byFrenchTitle).map((x) => x.id),
    [1, 2, 9]
  );
});

test('needsFallback: few AniList results', () => {
  assert.equal(needsFallback([]), true);
  assert.equal(needsFallback(Array.from({ length: 6 }, (_, i) => a(i, 'x'))), false);
});
