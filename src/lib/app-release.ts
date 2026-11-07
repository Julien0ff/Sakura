/**
 * « Application » page: which device the visitor is on, and which installer of the latest
 * GitHub release fits it. Pure module (no imports) so `node --test` can load it.
 */

export type Platform = 'windows' | 'linux' | 'mac' | 'android' | 'ios' | 'unknown';

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS 13+ reports a Mac user agent; a touch screen gives it away.
  if (/macintosh|mac os x/i.test(ua)) return maxTouchPoints > 1 ? 'ios' : 'mac';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return 'unknown';
}

/** The fields of GitHub's « list releases » API that are used. */
export interface GhRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  body: string | null;
  assets: { name: string; browser_download_url: string; size: number }[];
}

export interface Download {
  label: string;
  url: string;
  size: number;
}

export interface AppRelease {
  version: string;
  /** GitHub prerelease, or a version like 0.4.0-beta.1. */
  beta: boolean;
  publishedAt: string | null;
  notes: string;
  url: string;
  downloads: Partial<Record<'windows' | 'linux' | 'android' | 'ios', Download[]>>;
}

/** Installer kinds, in the order they're offered (first = main button). */
const KINDS: { platform: 'windows' | 'linux' | 'android'; test: RegExp; label: string }[] = [
  { platform: 'windows', test: /-setup\.exe$/i, label: 'Installateur (.exe)' },
  { platform: 'windows', test: /\.msi$/i, label: 'Installateur MSI' },
  { platform: 'linux', test: /\.AppImage$/i, label: 'AppImage' },
  { platform: 'linux', test: /\.deb$/i, label: 'Debian / Ubuntu (.deb)' },
  { platform: 'linux', test: /\.rpm$/i, label: 'Fedora / openSUSE (.rpm)' },
  { platform: 'android', test: /\.apk$/i, label: 'APK' },
];

/** Newest published `app-v*` release (prereleases included, flagged beta), or null. */
export function readRelease(releases: GhRelease[]): AppRelease | null {
  const r = releases.find((x) => !x.draft && x.tag_name.startsWith('app-v'));
  if (!r) return null;
  const version = r.tag_name.replace(/^app-v/, '');
  const downloads: AppRelease['downloads'] = {};
  for (const kind of KINDS) {
    for (const a of r.assets) {
      if (!kind.test.test(a.name)) continue;
      (downloads[kind.platform] ??= []).push({ label: kind.label, url: a.browser_download_url, size: a.size });
    }
  }
  return {
    version,
    beta: r.prerelease || /-(alpha|beta|rc)/i.test(version),
    publishedAt: r.published_at,
    notes: r.body ?? '',
    url: r.html_url,
    downloads,
  };
}
