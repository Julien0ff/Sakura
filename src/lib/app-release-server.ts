/**
 * Latest app release on GitHub, for the « Application » page, /api/app-release (update check of
 * the mobile apps) and /altstore.json. Server only, cached 2 min by Next's fetch cache.
 *
 * No GitHub API: its 60 requests/hour per IP run out on Vercel's shared IPs, and a refused
 * refresh left the cache serving an old release for hours. The updater's latest.json (a release
 * download, not rate-limited) gives the version, date and notes; each expected installer is then
 * checked with HEAD, which also gives its size.
 */
import { readRelease, releaseAssetNames } from '@/lib/app-release';

const REPO = 'Julien0ff/Sakura';
const CACHE = { next: { revalidate: 120 } };

export async function latestRelease() {
  try {
    const res = await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`, CACHE);
    if (!res.ok) return null;
    const latest = (await res.json()) as { version?: string; pub_date?: string; notes?: string };
    if (!latest.version) return null;
    const tag = `app-v${latest.version}`;
    const assets = await Promise.all(
      releaseAssetNames(latest.version).map(async (name) => {
        const url = `https://github.com/${REPO}/releases/download/${tag}/${name}`;
        try {
          const head = await fetch(url, { method: 'HEAD', ...CACHE });
          return head.ok ? { name, browser_download_url: url, size: Number(head.headers.get('content-length')) || 0 } : null;
        } catch {
          return null;
        }
      }),
    );
    return readRelease([
      {
        tag_name: tag,
        draft: false,
        prerelease: false,
        published_at: latest.pub_date ?? null,
        html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
        body: latest.notes ?? null,
        assets: assets.filter((a) => a !== null),
      },
    ]);
  } catch {
    return null;
  }
}
