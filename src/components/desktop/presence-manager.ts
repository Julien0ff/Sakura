'use client';

import { desktop, isApp, isDesktop } from '@/lib/desktop';
import { pickPresence, samePresence, type PresencePayload } from '@/lib/presence';

/**
 * Single source of the Discord activity (PC: Discord IPC; phones: Social SDK once linked): the player (when something plays) wins over
 * the page being browsed. Each part reports its own payload; one deduplicated update goes to the app.
 */
let page: PresencePayload | null = null;
let playback: PresencePayload | null = null;
let enabled = true;
let browsing = true;
let last: PresencePayload | null = null;
/** Phones: the app is in the background (home screen, other app). The PC app handles it natively (tray). */
let backgrounded = false;

/** When this tab (= the app window) started: browsing shows « depuis 12:34 ». */
export const SESSION_START = Date.now();

function updateWebPresence(p: PresencePayload | null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Window globals for PreMiD (execInPage / userscripts)
  (window as any).__SAKURA_PRESENCE__ = p;
  (window as any).premidData = p;

  let el = document.getElementById('premid-presence');
  if (!p) {
    if (el) el.remove();
    document.dispatchEvent(new CustomEvent('sakura:presence', { detail: null }));
    return;
  }

  if (!el) {
    el = document.createElement('div');
    el.id = 'premid-presence';
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }

  el.setAttribute('data-details', p.details || '');
  el.setAttribute('data-state', p.state || '');
  el.setAttribute('data-large-image', p.large_image || '');
  el.setAttribute('data-large-text', p.large_text || '');
  el.setAttribute('data-small-image', p.small_image || '');
  el.setAttribute('data-small-text', p.small_text || '');
  if (p.start != null) el.setAttribute('data-start', String(p.start));
  else el.removeAttribute('data-start');
  if (p.end != null) el.setAttribute('data-end', String(p.end));
  else el.removeAttribute('data-end');
  el.setAttribute('data-button-label', p.button_label || '');
  el.setAttribute('data-button-url', p.button_url || '');

  document.dispatchEvent(new CustomEvent('sakura:presence', { detail: p }));
}

function flush() {
  const next = enabled ? pickPresence(browsing ? page : null, playback) : null;
  updateWebPresence(next);

  if (!isApp()) return;
  const sent = backgrounded ? null : next;
  if (samePresence(last, sent)) return;
  last = sent;
  void desktop.setPresence(sent);
}

/** Mobile apps: leaving the app (home button, app switcher) clears the Discord activity; coming back
 * restores it. Sent right away: a backgrounded WebView may never run a timer. Picture-in-picture
 * keeps the page visible, so a video playing there keeps its status. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!isApp() || isDesktop()) return;
    const hidden = document.visibilityState === 'hidden';
    if (hidden === backgrounded) return;
    backgrounded = hidden;
    flush();
  });
}

export function setPagePresence(p: PresencePayload | null) {
  page = p;
  flush();
}

export function setPlaybackPresence(p: PresencePayload | null) {
  playback = p;
  flush();
}

/** Settings › Application › Statut Discord / Afficher la navigation. */
export function configurePresence(opts: { enabled: boolean; browsing: boolean }) {
  enabled = opts.enabled;
  browsing = opts.browsing;
  flush();
}
