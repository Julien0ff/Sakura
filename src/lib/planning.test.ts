import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolveQuery, inferDate, parisToEpoch, parsePlanning, readResolved } from './planning.ts';

const card = (classes: string, nom: string, lien: string, time: string, label = 'Saison 1') =>
  `<div class="as-carte as-carte-anime planning-card Anime ${classes}" data-url="/catalogue/${lien.split('/')[2]}/" data-cat="oeuvre" data-nom="${nom}" data-img="https://cdn.example/${nom}.jpg" data-lien="${lien}"><a><div class="as-carte-texte"><div class="as-carte-info"><svg></svg><span>${label}</span><span class="as-carte-temps">${time}</span></div></div></a></div>`;

const HTML = `
<div id="0" class="selectedRow px-1 py-4 rounded ">
  <h2 class="titreJours">Lundi </h2>
  <p class="text-white">02/11</p>
  ${card('VF  pl-sorti', 'The Ramparts of Ice', '/catalogue/the-ramparts-of-ice/saison2/vf/', '18h05', 'Saison 2')}
  ${card('VOSTFR  pl-sorti', 'JoJo&#039;s Bizarre Adventure', '/catalogue/jojos-bizarre-adventure/saison7/vostfr/', '10h35', 'Steel Ball Run')}
  <div class="as-carte as-carte-scan planning-card Scans VF" data-nom="Some Scan" data-lien="/catalogue/x/scan/vf/"><span class="as-carte-temps">?</span></div>
</div>
<div id="1" class="selectedRow px-1 py-4 rounded pl-aujourdhui">
  <h2 class="titreJours">Mardi</h2>
  <p class="text-white">03/11</p>
  ${card('VF', 'Ranma 1/2', '/catalogue/ranma1-2/saison4/vostfr/', '?', 'Saison 3')}
  ${card('VF pl-reporte', 'Helluva Boss', '/catalogue/helluva-boss/saison3/vf/', '?')}
  ${card('pl-reporte', 'Helluva Boss', '/catalogue/helluva-boss/saison3/vostfr/', '?')}
</div>`;

test('parsePlanning reads day, language, time, label and slug', () => {
  const rows = parsePlanning(HTML, new Date('2026-11-07T12:00:00Z'));
  assert.equal(rows.length, 5); // scans are skipped
  assert.deepEqual(rows[0], {
    title: 'The Ramparts of Ice', lang: 'vf', date: '2026-11-02', time: '18:05', label: 'Saison 2', slug: 'the-ramparts-of-ice', postponed: false,
    image: 'https://cdn.example/The Ramparts of Ice.jpg',
  });
  assert.equal(rows[1].title, "JoJo's Bizarre Adventure");
  assert.equal(rows[1].lang, 'vostfr');
});

test('the card class wins over the link language; unknown time is null', () => {
  const rows = parsePlanning(HTML, new Date('2026-11-07T12:00:00Z'));
  const ranma = rows.find((r) => r.slug === 'ranma1-2')!;
  assert.equal(ranma.lang, 'vf');
  assert.equal(ranma.time, null);
  assert.equal(ranma.date, '2026-11-03');
});

test('postponed cards are flagged; a card without language class falls back to the link', () => {
  const rows = parsePlanning(HTML, new Date('2026-11-07T12:00:00Z')).filter((r) => r.slug === 'helluva-boss');
  assert.deepEqual(rows.map((r) => [r.lang, r.postponed]), [['vf', true], ['vostfr', true]]);
});

test('inferDate picks the year closest to now across New Year', () => {
  assert.equal(inferDate('30/12', new Date('2027-01-02T00:00:00Z')), '2026-12-30');
  assert.equal(inferDate('02/01', new Date('2026-12-30T00:00:00Z')), '2027-01-02');
  assert.equal(inferDate('nope', new Date()), null);
});

test('parisToEpoch handles winter and summer time', () => {
  assert.equal(parisToEpoch('2026-11-02', '18:05'), Date.UTC(2026, 10, 2, 17, 5) / 1000);
  assert.equal(parisToEpoch('2026-07-01', '18:05'), Date.UTC(2026, 6, 1, 16, 5) / 1000);
});

test('buildResolveQuery aliases one search per title, with variables', () => {
  const { query, variables } = buildResolveQuery(['Blue Box', 'Ranma 1/2']);
  assert.match(query, /query \(\$s0: String, \$s1: String\)/);
  assert.match(query, /a0: Page\(perPage: 1\) \{ media\(search: \$s0/);
  assert.match(query, /a1: Page\(perPage: 1\) \{ media\(search: \$s1/);
  assert.deepEqual(variables, { s0: 'Blue Box', s1: 'Ranma 1/2' });
});

test('readResolved maps titles to AniList media and skips misses and adult entries', () => {
  const data = {
    a0: { media: [{ id: 1, isAdult: false, coverImage: { large: 'c', color: '#fff' }, title: { romaji: 'Ao no Hako' } }] },
    a1: { media: [] },
    a2: { media: [{ id: 3, isAdult: true, coverImage: { large: 'x' }, title: { romaji: 'x' } }] },
  };
  const m = readResolved(['Blue Box', 'Nope', 'Adult'], data);
  assert.deepEqual([...m.keys()], ['Blue Box']);
  assert.equal(m.get('Blue Box')!.id, 1);
});
