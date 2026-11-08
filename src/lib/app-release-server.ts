/**
 * Latest app release on GitHub, for the « Application » page, /api/app-release (update check of
 * the mobile apps) and /altstore.json. Server only, cached 2 min by Next's fetch cache.
 *
 * No GitHub API: its 60 requests/hour per IP run out on Vercel's shared IPs, and a refused
 * refresh left the cache serving an old release for hours. The updater's latest.json (a release
 * download, not rate-limited) gives the version, date and notes; each expected installer is then
 * checked with HEAD, which also gives its size. The API is only used while a new release is
 * still building (see lastCompleteTag).
 */
import { lastCompleteTag, readRelease, releaseAssetNames } from '@/lib/app-release';

const REPO = 'Julien0ff/Sakura';
const CACHE = { next: { revalidate: 120 } };
/**
 * GitHub can hang (seen on Vercel's build machines, where /app is pre-rendered and Next gives up
 * after 60 s): every request gets a deadline; past it the page shows no release until the next
 * refresh (2 min) instead of failing the build.
 */
const TIMEOUT_MS = 8000;
const deadline = () => ({ signal: AbortSignal.timeout(TIMEOUT_MS) });

export async function latestRelease() {
  try {
    const res = await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`, { ...CACHE, ...deadline() });
    if (res.ok) return await releaseFrom(res);
    // The newest release is still being built (no latest.json yet): show the previous one.
    // GitHub API only here, rarely (a few minutes per release), well within its rate limit.
    const list = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      ...CACHE,
      ...deadline(),
      headers: { Accept: 'application/vnd.github+json' },
    });
    const tag = list.ok ? lastCompleteTag(await list.json()) : null;
    if (!tag) return null;
    const previous = await fetch(`https://github.com/${REPO}/releases/download/${tag}/latest.json`, { ...CACHE, ...deadline() });
    return previous.ok ? await releaseFrom(previous) : null;
  } catch {
    return null;
  }
}

/** A release's latest.json → the release, with each expected installer checked by HEAD. */
async function releaseFrom(res: Response) {
  const latest = (await res.json()) as { version?: string; pub_date?: string; notes?: string };
  if (!latest.version) return null;
  const tag = `app-v${latest.version}`;
  const assets = await Promise.all(
    releaseAssetNames(latest.version).map(async (name) => {
      const url = `https://github.com/${REPO}/releases/download/${tag}/${name}`;
      try {
        const head = await fetch(url, { method: 'HEAD', ...CACHE, ...deadline() });
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
}
