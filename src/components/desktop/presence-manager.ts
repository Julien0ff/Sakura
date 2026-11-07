'use client';

import { desktop, isApp } from '@/lib/desktop';
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

/** When this tab (= the app window) started: browsing shows « depuis 12:34 ». */
export const SESSION_START = Date.now();

function flush() {
  if (!isApp()) return;
  const next = enabled ? pickPresence(browsing ? page : null, playback) : null;
  if (samePresence(last, next)) return;
  last = next;
  void desktop.setPresence(next);
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
