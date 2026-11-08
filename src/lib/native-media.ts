/**
 * Android app only: the Android WebView shows no media notification and has no picture-in-picture
 * of its own, so the app's Kotlin side (scripts/mobile/android-media.py → SakuraMedia.kt) exposes
 * `window.SakuraAndroid`. Everywhere else (website, PC, iPhone) these calls do nothing and the
 * standard `navigator.mediaSession` is used.
 *
 * - `setWatching(true)` while the player is open: leaving the app then shrinks it to picture-in-picture.
 * - `update(json)` / `clear()`: the media notification (episode, anime, artwork, play state, position).
 * - Buttons in the notification come back as a `sakura-media` window event.
 */

interface Bridge {
  setWatching(on: boolean): void;
  update(json: string): void;
  clear(): void;
}

export type NowPlayingMeta = { title: string; artist: string; artwork?: string };
export type NowPlayingState = { playing: boolean; position: number; duration: number };
export type NativeMediaAction = { action: 'play' | 'pause' | 'seekbackward' | 'seekforward' | 'seekto'; time?: number };

const bridge = (): Bridge | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { SakuraAndroid?: Bridge }).SakuraAndroid);

let meta: NowPlayingMeta | null = null;
let state: NowPlayingState | null = null;

function push() {
  const b = bridge();
  if (!b) return;
  if (meta && state) b.update(JSON.stringify({ ...meta, ...state }));
  else b.clear();
}

export function setPlayerOpen(open: boolean) {
  bridge()?.setWatching(open);
}

export function setNowPlayingMeta(m: NowPlayingMeta | null) {
  meta = m;
  push();
}

export function setNowPlayingState(s: NowPlayingState | null) {
  state = s;
  push();
}

/** Notification buttons (Android app). Returns the unsubscribe function. */
export function onNativeMediaAction(handler: (a: NativeMediaAction) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<NativeMediaAction>).detail);
  window.addEventListener('sakura-media', listener);
  return () => window.removeEventListener('sakura-media', listener);
}
