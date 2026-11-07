/** Which SAKURA app runs this page. Pure module (no imports) so `node --test` can load it. */
export type AppKind = 'desktop' | 'android' | 'ios';

/** `isTauri`: Tauri's injected flag; null = plain website. */
export function appKind(isTauri: boolean, ua: string, maxTouchPoints = 0): AppKind | null {
  if (!isTauri) return null;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS webviews may report a Mac user agent; a touch screen gives them away.
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}
