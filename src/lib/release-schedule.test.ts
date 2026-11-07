import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationId, upcomingReleases, HORIZON_S, MAX_SCHEDULED } from './release-schedule.ts';

const NOW = 1_800_000_000;
const targets = (langs: ('vf' | 'vostfr')[]) => ({ anime: [{ id: 1, title: 'Blue Box' }, { id: 2, title: 'Frieren' }], langs });
const vf = (id: number | null, airingAt: number, time: string | null = '18:00', label: string | null = null) => ({
  lang: 'vf' as const,
  label,
  time,
  airingAt,
  anilist: id === null ? null : { id },
});

test('VOSTFR: followed episodes airing in the next 7 days, same text as the PC app', () => {
  const out = upcomingReleases(
    targets(['vostfr']),
    [
      { mediaId: 1, episode: 5, airingAt: NOW + 3600 },
      { mediaId: 1, episode: 4, airingAt: NOW - 60 }, // already out
      { mediaId: 2, episode: 9, airingAt: NOW + HORIZON_S + 1 }, // after 7 days
      { mediaId: 3, episode: 1, airingAt: NOW + 60 }, // not followed
    ],
    [],
    NOW,
  );
  assert.deepEqual(out, [
    { id: notificationId('a:1:5'), at: (NOW + 3600) * 1000, title: 'Blue Box', body: 'L’épisode 5 est disponible en VOSTFR.' },
  ]);
});

test('VF: planning items matched to a followed anime; unknown hour → announced at 00:00 Paris', () => {
  const evening = NOW + 2 * 86_400; // 23:59 placeholder when time is null
  const out = upcomingReleases(
    targets(['vf']),
    [{ mediaId: 1, episode: 5, airingAt: NOW + 3600 }],
    [vf(2, NOW + 7200, '18:00', 'Saison 2'), vf(1, evening, null), vf(null, NOW + 60), { ...vf(1, NOW + 60), lang: 'vostfr' as const }],
    NOW,
  );
  assert.deepEqual(
    out.map((n) => [n.title, n.body, n.at / 1000]),
    [
      ['Frieren', 'Nouvel épisode en VF (Saison 2).', NOW + 7200],
      ['Blue Box', 'Nouvel épisode en VF.', evening - (23 * 3600 + 59 * 60)],
    ],
  );
});

test('a midnight-shifted VF release already past is dropped', () => {
  const out = upcomingReleases(targets(['vf']), [], [vf(1, NOW + 3600, null)], NOW);
  assert.deepEqual(out, []);
});

test('no languages or no anime → nothing', () => {
  assert.deepEqual(upcomingReleases({ anime: [], langs: ['vf', 'vostfr'] }, [{ mediaId: 1, episode: 1, airingAt: NOW + 5 }], [], NOW), []);
  assert.deepEqual(upcomingReleases(targets([]), [{ mediaId: 1, episode: 1, airingAt: NOW + 5 }], [], NOW), []);
});

test('sorted by time and capped (iOS keeps 64 pending notifications)', () => {
  const airing = Array.from({ length: 100 }, (_, i) => ({ mediaId: 1, episode: 100 - i, airingAt: NOW + 1000 + (100 - i) }));
  const out = upcomingReleases(targets(['vostfr']), airing, [], NOW);
  assert.equal(out.length, MAX_SCHEDULED);
  assert.ok(out.every((n, i) => i === 0 || n.at >= out[i - 1].at));
  assert.equal(out[0].body, 'L’épisode 1 est disponible en VOSTFR.');
});

test('notificationId: stable positive 31-bit integer (Android notification ids are ints)', () => {
  const a = notificationId('a:1:5');
  assert.equal(a, notificationId('a:1:5'));
  assert.notEqual(a, notificationId('a:1:6'));
  assert.ok(Number.isInteger(a) && a > 0 && a < 2 ** 31);
});
