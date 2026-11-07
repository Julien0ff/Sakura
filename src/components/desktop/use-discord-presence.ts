'use client';

import { useEffect } from 'react';
import { isApp } from '@/lib/desktop';
import { buildBrowsingPresence, buildPresence, type PresenceInput } from '@/lib/presence';
import { SESSION_START, setPagePresence, setPlaybackPresence } from './presence-manager';

export type PresenceEpisode = Omit<PresenceInput, 'playing' | 'time' | 'duration' | 'now' | 'origin'>;
export interface Playback {
  playing: boolean;
  time: number;
  duration: number;
}

/**
 * SAKURA apps: mirrors the player into Discord (« Regarde <anime> »). `episode` null = no player
 * open → back to the page's status.
 */
export function useDiscordPresence(episode: PresenceEpisode | null, playback: Playback) {
  useEffect(() => {
    if (!isApp()) return;
    setPlaybackPresence(episode ? buildPresence({ ...episode, ...playback, now: Date.now(), origin: window.location.origin }) : null);
  }, [episode, playback]);

  useEffect(() => () => setPlaybackPresence(null), []);
}

/** SAKURA apps: « Death Note · Consulte la fiche » while on an anime page (null = still loading). */
export function useAnimePagePresence(anime: { id: number; title: string; cover: string | null } | null) {
  const id = anime?.id;
  const title = anime?.title;
  const cover = anime?.cover ?? null;
  useEffect(() => {
    if (!isApp()) return;
    setPagePresence(
      buildBrowsingPresence({
        path: '/anime',
        since: SESSION_START,
        origin: window.location.origin,
        anime: id && title ? { id, title, cover } : undefined,
      })
    );
  }, [id, title, cover]);
}
