import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altstoreSource, detectPlatform, isNewerVersion, readRelease, releaseAssetNames } from './app-release.ts';
import { lastCompleteTag } from './app-release.ts';

test('detectPlatform from the user agent', () => {
  assert.equal(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'), 'windows');
  assert.equal(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/140'), 'linux');
  assert.equal(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140 Mobile'), 'android');
  assert.equal(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Safari'), 'ios');
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Safari', 0), 'mac');
  // iPadOS pretends to be a Mac, but has touch.
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Safari', 5), 'ios');
  assert.equal(detectPlatform('curl/8'), 'unknown');
});

const asset = (name: string) => ({ name, browser_download_url: `https://github.com/x/releases/download/v/${name}`, size: 1000 });

test('readRelease picks the newest published app release and its installers', () => {
  const r = readRelease([
    { tag_name: 'app-v0.3.0', draft: true, prerelease: false, published_at: null, html_url: 'h3', body: '', assets: [] },
    { tag_name: 'site-v9', draft: false, prerelease: false, published_at: '2026-11-08T00:00:00Z', html_url: 'hs', body: '', assets: [] },
    {
      tag_name: 'app-v0.2.0', draft: false, prerelease: false, published_at: '2026-11-07T14:43:43Z', html_url: 'h2', body: 'Notes',
      assets: ['SAKURA_0.2.0_x64-setup.exe', 'SAKURA_0.2.0_amd64.AppImage', 'SAKURA_0.2.0_amd64.AppImage.sig', 'SAKURA_0.2.0_amd64.deb', 'SAKURA-0.2.0-1.x86_64.rpm', 'latest.json'].map(asset),
    },
  ])!;
  assert.equal(r.version, '0.2.0');
  assert.equal(r.beta, false);
  assert.equal(r.url, 'h2');
  assert.equal(r.downloads.windows?.[0].label, 'Installateur (.exe)');
  assert.deepEqual(r.downloads.linux?.map((d) => d.label), ['AppImage', 'Debian / Ubuntu (.deb)', 'Fedora / openSUSE (.rpm)']);
  assert.equal(r.downloads.android, undefined);
});

test('a prerelease is flagged beta; an .apk becomes the Android download', () => {
  const r = readRelease([{ tag_name: 'app-v0.4.0-beta.1', draft: false, prerelease: true, published_at: 'x', html_url: 'h', body: '', assets: [asset('SAKURA_0.4.0.apk')] }])!;
  assert.equal(r.beta, true);
  assert.equal(r.version, '0.4.0-beta.1');
  assert.equal(r.downloads.android?.[0].label, 'APK');
});

test('no app release → null', () => {
  assert.equal(readRelease([]), null);
});

test('an .ipa becomes the iPhone download (AltStore / SideStore)', () => {
  const r = readRelease([{ tag_name: 'app-v0.4.0', draft: false, prerelease: false, published_at: 'x', html_url: 'h', body: '', assets: [asset('SAKURA_0.4.0_ios.ipa'), asset('SAKURA_0.4.0_android.apk')] }])!;
  assert.equal(r.downloads.ios?.[0].label, 'IPA (AltStore / SideStore)');
  assert.equal(r.downloads.android?.[0].label, 'APK');
});

test('releaseAssetNames: the installers CI publishes for a version', () => {
  const names = releaseAssetNames('0.4.0');
  assert.deepEqual(names, [
    'SAKURA_0.4.0_x64-setup.exe',
    'SAKURA_0.4.0_x64_en-US.msi',
    'SAKURA_0.4.0_amd64.AppImage',
    'SAKURA_0.4.0_amd64.deb',
    'SAKURA-0.4.0-1.x86_64.rpm',
    'SAKURA_0.4.0_android.apk',
    'SAKURA_0.4.0_ios.ipa',
  ]);
  // Every name is recognised by readRelease, one per platform kind.
  const r = readRelease([{ tag_name: 'app-v0.4.0', draft: false, prerelease: false, published_at: null, html_url: 'h', body: '', assets: names.map(asset) }])!;
  assert.equal(r.downloads.windows?.length, 2);
  assert.equal(r.downloads.linux?.length, 3);
  assert.equal(r.downloads.android?.length, 1);
  assert.equal(r.downloads.ios?.length, 1);
});

test('isNewerVersion compares dotted versions, prereleases below their release', () => {
  assert.equal(isNewerVersion('0.5.0', '0.4.0'), true);
  assert.equal(isNewerVersion('0.10.0', '0.9.3'), true);
  assert.equal(isNewerVersion('0.4.0', '0.4.0'), false);
  assert.equal(isNewerVersion('0.4.0', '0.5.0'), false);
  assert.equal(isNewerVersion('1.0.0', '1.0.0-beta.2'), true);
  assert.equal(isNewerVersion('1.0.0-beta.1', '1.0.0'), false);
  assert.equal(isNewerVersion('garbage', '0.1.0'), false);
});

test('altstoreSource: AltStore / SideStore source with the latest .ipa', () => {
  const release = readRelease([
    {
      tag_name: 'app-v0.5.0', draft: false, prerelease: false, published_at: '2026-11-08T10:00:00Z', html_url: 'h', body: 'Notes',
      assets: [{ name: 'SAKURA_0.5.0_ios.ipa', browser_download_url: 'https://dl/ipa', size: 5_000_000 }],
    },
  ]);
  const src = altstoreSource(release, 'https://sakura.thefoxy.me');
  assert.equal(src.name, 'SAKURA');
  assert.equal(src.iconURL, 'https://sakura.thefoxy.me/icon.png');
  const app = src.apps[0];
  assert.equal(app.bundleIdentifier, 'app.sakura.desktop');
  assert.deepEqual(app.versions, [
    { version: '0.5.0', buildVersion: '0.5.0', date: '2026-11-08T10:00:00Z', localizedDescription: 'Notes', downloadURL: 'https://dl/ipa', size: 5_000_000, minOSVersion: '15.0' },
  ]);
  assert.deepEqual(app.appPermissions, { entitlements: [], privacy: {} });
});

test('altstoreSource without an .ipa: the app is listed with no version', () => {
  assert.deepEqual(altstoreSource(null, 'https://x').apps[0].versions, []);
});

test('lastCompleteTag: newest published release that already has its latest.json', () => {
  const releases = [
    { tag_name: 'app-v0.5.2', draft: false, prerelease: false, assets: [{ name: 'SAKURA_0.5.2_android.apk' }] }, // still building
    { tag_name: 'app-v0.6.0', draft: true, prerelease: false, assets: [{ name: 'latest.json' }] },
    { tag_name: 'app-v0.5.1', draft: false, prerelease: false, assets: [{ name: 'latest.json' }, { name: 'SAKURA_0.5.1_android.apk' }] },
    { tag_name: 'app-v0.5.0', draft: false, prerelease: false, assets: [{ name: 'latest.json' }] },
  ];
  assert.equal(lastCompleteTag(releases), 'app-v0.5.1');
  assert.equal(lastCompleteTag(releases.slice(0, 2)), null);
  assert.equal(lastCompleteTag('not a list'), null);
});
