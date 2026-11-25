import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDirectStream, parseEmbedPlaylist, withDirectStreams } from './direct-stream.ts';

const page = `jwplayer("vplayer").setup({ sources: [{ file: 'https://prx.vmpx.online/hls2/x/master.m3u8?t=abc&amp;s=1&e=43200' }], image: 'x.jpg'`;

test('reads the HLS playlist of an ansembed page', () => {
  assert.equal(parseEmbedPlaylist(page), 'https://prx.vmpx.online/hls2/x/master.m3u8?t=abc&s=1&e=43200');
  assert.equal(parseEmbedPlaylist('<html>no player</html>'), null);
});

test('only ansembed/vidmoly embeds are probed', () => {
  assert.equal(hasDirectStream('https://ansembed.net/embed-abc.html'), true);
  assert.equal(hasDirectStream('https://uqload.vc/embed-abc.html'), false);
});

test('the direct stream comes first, the embed stays as a fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(page));
  const out = await withDirectStreams([
    { url: 'https://ansembed.net/embed-abc.html', type: 'iframe' as const, quality: 'Ansembed' },
    { url: 'https://uqload.vc/embed-abc.html', type: 'iframe' as const, quality: 'Uqload' },
  ]);
  assert.deepEqual(out.map((s) => [s.type, s.quality]), [['hls', 'Ansembed · sans pub'], ['iframe', 'Ansembed'], ['iframe', 'Uqload']]);
});

test('a page without stream leaves the sources unchanged', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('blocked', { status: 403 }));
  const src = [{ url: 'https://ansembed.net/embed-abc.html', type: 'iframe' as const }];
  assert.deepEqual(await withDirectStreams(src), src);
});
