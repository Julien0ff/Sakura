/**
 * Mobile apps (M3), Android: is a newer .apk published? The site's /api/app-release reads the
 * latest GitHub release; Android then asks the user to confirm the install of the downloaded file.
 * iPhone updates go through the AltStore / SideStore source (/altstore.json) instead.
 */
import { currentApp, desktop } from '@/lib/desktop';
import { isNewerVersion } from '@/lib/app-release';

export interface MobileUpdate {
  version: string;
  url: string;
}

export async function checkAndroidUpdate(): Promise<MobileUpdate | null> {
  if (currentApp() !== 'android') return null;
  const [current, res] = await Promise.all([desktop.version(), fetch('/api/app-release', { cache: 'no-store' })]);
  if (!current || !res.ok) return null;
  const latest = (await res.json()) as { version: string; android: string | null } | null;
  if (!latest?.android || !isNewerVersion(latest.version, current)) return null;
  return { version: latest.version, url: latest.android };
}
