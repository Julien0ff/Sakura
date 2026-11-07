/**
 * Bridge to the SAKURA apps (Tauri: desktop, Android, iPhone). Every function is a no-op on the
 * website: the app's commands only exist when the page runs inside an app.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { appKind, type AppKind } from '@/lib/app-kind';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PresencePayload } from '@/lib/presence';
import type { NotifyTargets } from '@/lib/notify-targets';

export interface AuthLink {
  code: string | null;
  next: string | null;
  error: string | null;
}

export interface UpdateInfo {
  version: string;
  notes: string | null;
  /** false for .deb / .rpm installs: the update is downloaded from the release page instead. */
  installable: boolean;
}

export type PresenceStatus = 'idle' | 'connected' | 'discord_not_found' | 'rejected';

/** Mobile apps: Discord account link (Social SDK). */
export interface DiscordLinkStatus {
  state: 'unavailable' | 'not_linked' | 'linking' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

export const RELEASES_URL = 'https://github.com/Julien0ff/Sakura/releases/latest';

/** Which app runs this page (null on the website). */
export function currentApp(): AppKind | null {
  if (typeof window === 'undefined') return null;
  return appKind(isTauri(), navigator.userAgent, navigator.maxTouchPoints);
}

/** Any SAKURA app (desktop or mobile): sign-in through the system browser, shared commands. */
export function isApp(): boolean {
  return currentApp() !== null;
}

/** The desktop app only: tray, autostart, Discord IPC, release checks, self-update. */
export function isDesktop(): boolean {
  return currentApp() === 'desktop';
}

export function isMobileApp(): boolean {
  const k = currentApp();
  return k === 'android' || k === 'ios';
}

/**
 * Desktop app on Linux = WebKitGTK, much slower than Chromium on blur / scroll effects:
 * `html.app-lite` turns them off (see globals.css).
 */
export function isLiteRendering(): boolean {
  return isDesktop() && /Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isApp()) return null;
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[desktop] ${cmd} failed`, e);
    return null;
  }
}

/** Like `call`, but failures reach the caller (actions the user is waiting on). */
async function callOrThrow<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isApp()) throw new Error('Disponible uniquement dans l’application SAKURA');
  return invoke<T>(cmd, args);
}

async function on<T>(event: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  if (!isApp()) return () => {};
  return listen<T>(event, (e) => cb(e.payload));
}

export const desktop = {
  openExternal: (url: string) => callOrThrow<void>('open_external', { url }),
  takePendingAuth: () => call<AuthLink>('take_pending_auth'),
  onAuthCallback: (cb: (link: AuthLink) => void) => on<AuthLink>('auth-callback', cb),
  getAutostart: () => call<boolean>('get_autostart'),
  setAutostart: (enabled: boolean) => call<void>('set_autostart', { enabled }),
  version: () => call<string>('app_version'),
  /** Resolves null when up to date; rejects when the check failed. */
  checkUpdate: () => callOrThrow<UpdateInfo | null>('check_update'),
  presenceStatus: () => call<PresenceStatus>('presence_status'),
  installUpdate: () => callOrThrow<void>('install_update'),
  /** Discord « Regarde … »; null clears it. */
  setPresence: (activity: PresencePayload | null) => call<void>('set_presence', { activity }),
  /** Anime + languages the app checks for new episodes (persisted by the app). */
  setNotifyTargets: (targets: NotifyTargets) => call<void>('set_notify_targets', { targets }),
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => on<UpdateInfo>('update-available', cb),
  /** Mobile: opens Discord's « Authorize SAKURA » screen. */
  discordLink: () => callOrThrow<void>('discord_link'),
  discordUnlink: () => call<void>('discord_unlink'),
  discordStatus: () => call<DiscordLinkStatus>('discord_status'),
};
