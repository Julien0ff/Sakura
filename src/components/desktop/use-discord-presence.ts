'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/core/store';
import { desktop, isDesktop } from '@/lib/desktop';
import { buildPresence, type PresenceInput, type PresencePayload } from '@/lib/presence';

export type PresenceEpisode = Omit<PresenceInput, 'playing' | 'time' | 'duration' | 'now' | 'origin'>;
export interface Playback {
  playing: boolean;
  time: number;
  duration: number;
}

/** A new time bar is only sent when it moved by more than this (seek), not on every progress tick. */
const DRIFT_S = 10;

/**
 * Desktop app: mirrors the player into Discord (« Regarde <anime> »). `episode` null = no player
 * open → activity cleared. Respects Settings › Application › Statut Discord.
 */
export function useDiscordPresence(episode: PresenceEpisode | null, playback: Playback) {
  const enabled = useAppStore((s) => s.settings.discordPresence ?? true);
  const last = useRef<PresencePayload | null>(null);

  useEffect(() => {
    if (!isDesktop()) return;
    if (!enabled || !episode) {
      if (last.current) {
        last.current = null;
        void desktop.setPresence(null);
      }
      return;
    }
    const next = buildPresence({ ...episode, ...playback, now: Date.now(), origin: window.location.origin });
    const prev = last.current;
    const same =
      prev &&
      prev.details === next.details &&
      prev.state === next.state &&
      prev.large_image === next.large_image &&
      (prev.start === undefined) === (next.start === undefined) &&
      Math.abs((prev.start ?? 0) - (next.start ?? 0)) <= DRIFT_S;
    if (same) return;
    last.current = next;
    void desktop.setPresence(next);
  }, [enabled, episode, playback]);

  // Leaving the page (or the app reloading it) clears the status.
  useEffect(
    () => () => {
      if (last.current) {
        last.current = null;
        void desktop.setPresence(null);
      }
    },
    []
  );
}
