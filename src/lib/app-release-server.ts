/**
 * Latest app release on GitHub, for the « Application » page, /api/app-release (update check of
 * the mobile apps) and /altstore.json. Server only: cached 15 min by Next's fetch cache.
 */
import { readRelease, releaseAssetNames, type GhRelease } from '@/lib/app-release';

const REPO = 'Julien0ff/Sakura';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const CACHE = { next: { revalidate: 900 } };

/** GitHub API: 60 anonymous requests per hour per IP, often used up on Vercel's shared IPs. */
async function fromApi() {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SAKURA', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...CACHE,
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return readRelease((await res.json()) as GhRelease[]);
}

/**
 * Fallback without the API (no rate limit): the updater's latest.json gives the version, then each
 * expected installer is checked (HEAD), which also gives its size.
 */
async function fromDownloads() {
  const res = await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`, CACHE);
  if (!res.ok) return null;
  const latest = (await res.json()) as { version?: string; pub_date?: string };
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
      body: null,
      assets: assets.filter((a) => a !== null),
    },
  ]);
}

export async function latestRelease() {
  try {
    return await fromApi();
  } catch {
    try {
      return await fromDownloads();
    } catch {
      return null;
    }
  }
}

