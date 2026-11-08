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
const KINDS: { platform: 'windows' | 'linux' | 'android' | 'ios'; test: RegExp; label: string }[] = [
  { platform: 'windows', test: /-setup\.exe$/i, label: 'Installateur (.exe)' },
  { platform: 'windows', test: /\.msi$/i, label: 'Installateur MSI' },
  { platform: 'linux', test: /\.AppImage$/i, label: 'AppImage' },
  { platform: 'linux', test: /\.deb$/i, label: 'Debian / Ubuntu (.deb)' },
  { platform: 'linux', test: /\.rpm$/i, label: 'Fedora / openSUSE (.rpm)' },
  { platform: 'android', test: /\.apk$/i, label: 'APK' },
  { platform: 'ios', test: /\.ipa$/i, label: 'IPA (AltStore / SideStore)' },
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

/**
 * File names the release workflows attach for a version (desktop: tauri-action, mobile:
 * mobile-release.yml). Used when GitHub's API is rate-limited: the files are then checked one by one.
 */
export function releaseAssetNames(version: string): string[] {
  return [
    `SAKURA_${version}_x64-setup.exe`,
    `SAKURA_${version}_x64_en-US.msi`,
    `SAKURA_${version}_amd64.AppImage`,
    `SAKURA_${version}_amd64.deb`,
    `SAKURA-${version}-1.x86_64.rpm`,
    `SAKURA_${version}_android.apk`,
    `SAKURA_${version}_ios.ipa`,
  ];
}

/** true when `latest` is a newer version than `current` (1.2.10 > 1.2.9; 1.0.0 > 1.0.0-beta.2). */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(v.trim());
    return m ? { nums: [+m[1], +m[2], +m[3]], pre: m[4] ?? null } : null;
  };
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i];
  if (a.pre === b.pre) return false;
  if (a.pre === null) return true; // release > its prerelease
  if (b.pre === null) return false;
  return a.pre.localeCompare(b.pre, 'en', { numeric: true }) > 0;
}

/** iPhone build (Tauri: CFBundleShortVersionString and CFBundleVersion = app version). */
const IOS_BUNDLE_ID = 'app.sakura.desktop';
const IOS_MIN_OS = '15.0';
const TINT = '#FF7AA8';

/**
 * AltStore / SideStore source (format v2) served at /altstore.json: adding it once lets
 * AltStore and SideStore offer each new .ipa as an update.
 */
export function altstoreSource(release: AppRelease | null, origin: string) {
  const ipa = release?.downloads.ios?.[0];
  const description =
    'Catalogue et lecteur d’animes en VOSTFR et VF, sans publicité. Reprise de lecture, suivi de vos séries, calendrier des sorties et notifications des nouveaux épisodes.';
  return {
    name: 'SAKURA',
    identifier: 'me.thefoxy.sakura.source',
    subtitle: 'Vos animes, sans publicité.',
    description,
    iconURL: `${origin}/icon.png`,
    website: origin,
    tintColor: TINT,
    apps: [
      {
        name: 'SAKURA',
        bundleIdentifier: IOS_BUNDLE_ID,
        developerName: 'SAKURA',
        subtitle: 'Vos animes, sans publicité.',
        localizedDescription: description,
        iconURL: `${origin}/icon.png`,
        tintColor: TINT,
        category: 'entertainment',
        screenshots: [] as string[],
        versions:
          release && ipa
            ? [
                {
                  version: release.version,
                  buildVersion: release.version,
                  date: release.publishedAt ?? new Date(0).toISOString(),
                  localizedDescription: release.notes || 'Nouvelle version de SAKURA.',
                  downloadURL: ipa.url,
                  size: ipa.size,
                  minOSVersion: IOS_MIN_OS,
                },
              ]
            : [],
        appPermissions: { entitlements: [] as string[], privacy: {} as Record<string, string> },
      },
    ],
    news: [] as unknown[],
  };
}

export const ALTSTORE_SOURCE_URL = 'https://sakura.thefoxy.me/altstore.json';
/** « Add this source » links (iPhone): once added, AltStore / SideStore offer each new version. */
export const ADD_SOURCE_LINKS = {
  sidestore: `sidestore://source?url=${ALTSTORE_SOURCE_URL}`,
  altstore: `altstore://source?url=${ALTSTORE_SOURCE_URL}`,
};

/**
 * While a release is being built, GitHub already lists it as « latest » but its latest.json (the
 * last file the desktop build uploads) is missing: fall back to the newest published release that
 * has one. `releases` is the GitHub API list (newest first).
 */
export function lastCompleteTag(releases: unknown): string | null {
  if (!Array.isArray(releases)) return null;
  const done = (releases as { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: { name?: string }[] }[]).find(
    (r) => !r.draft && !r.prerelease && typeof r.tag_name === 'string' && r.assets?.some((a) => a.name === 'latest.json'),
  );
  return done?.tag_name ?? null;
}
