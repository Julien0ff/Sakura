/**
 * Bridge to the SAKURA desktop app (Tauri). Every function is a no-op on the website:
 * the app's commands only exist when the page runs inside the app window.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

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

export const RELEASES_URL = 'https://github.com/Julien0ff/Sakura/releases/latest';

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && isTauri();
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isDesktop()) return null;
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[desktop] ${cmd} failed`, e);
    return null;
  }
}

/** Like `call`, but failures reach the caller (actions the user is waiting on). */
async function callOrThrow<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktop()) throw new Error('Disponible uniquement dans l’application SAKURA');
  return invoke<T>(cmd, args);
}

async function on<T>(event: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  if (!isDesktop()) return () => {};
  return listen<T>(event, (e) => cb(e.payload));
}

export const desktop = {
  openExternal: (url: string) => callOrThrow<void>('open_external', { url }),
  takePendingAuth: () => call<AuthLink>('take_pending_auth'),
  onAuthCallback: (cb: (link: AuthLink) => void) => on<AuthLink>('auth-callback', cb),
  getAutostart: () => call<boolean>('get_autostart'),
  setAutostart: (enabled: boolean) => call<void>('set_autostart', { enabled }),
  version: () => call<string>('app_version'),
  checkUpdate: () => call<UpdateInfo>('check_update'),
  installUpdate: () => callOrThrow<void>('install_update'),
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => on<UpdateInfo>('update-available', cb),
};
