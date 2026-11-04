'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedAnime {
  id: number;
  title: string;
  cover: string;
  color?: string | null;
  score?: number | null;
  status?: string | null;
}

export interface HistoryEntry extends SavedAnime {
  episodeNumber: number;
  episodeName: string;
  season: number;
  lang: Lang;
  watchedAt: number;
}

export type Lang = 'vostfr' | 'vf';

/** Playback position per episode, keyed by `${animeId}:${season}:${episode}`. */
export interface EpisodeProgress {
  time: number;
  duration: number;
  updatedAt: number;
}

export const progressKey = (animeId: number, season: number, episode: number) => `${animeId}:${season}:${episode}`;

/** An episode counts as watched past 90 % (credits are usually the last ~10 %). */
export const isWatched = (p?: EpisodeProgress) => !!p && p.duration > 0 && p.time / p.duration >= 0.9;

interface AppState {
  watchlist: SavedAnime[];
  history: HistoryEntry[];
  progress: Record<string, EpisodeProgress>;
  settings: { defaultLang: Lang; autoSkip: boolean; autoNext: boolean };
  saveProgress: (key: string, time: number, duration: number) => void;
  toggleWatchlist: (anime: SavedAnime) => void;
  addToHistory: (entry: Omit<HistoryEntry, 'watchedAt'>) => void;
  removeFromHistory: (id: number) => void;
  clearHistory: () => void;
  updateSettings: (patch: Partial<AppState['settings']>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      watchlist: [],
      history: [],
      progress: {},
      settings: { defaultLang: 'vostfr', autoSkip: false, autoNext: true },
      saveProgress: (key, time, duration) =>
        set((s) => {
          const progress = { ...s.progress, [key]: { time, duration, updatedAt: Date.now() } };
          // Keep the 500 most recent entries so localStorage stays small.
          const keys = Object.keys(progress);
          if (keys.length > 500) {
            keys
              .sort((a, b) => progress[a].updatedAt - progress[b].updatedAt)
              .slice(0, keys.length - 500)
              .forEach((k) => delete progress[k]);
          }
          return { progress };
        }),
      toggleWatchlist: (anime) =>
        set((s) => ({
          watchlist: s.watchlist.some((a) => a.id === anime.id)
            ? s.watchlist.filter((a) => a.id !== anime.id)
            : [anime, ...s.watchlist],
        })),
      // One entry per anime (latest episode watched), most recent first, capped at 100.
      addToHistory: (entry) =>
        set((s) => ({
          history: [{ ...entry, watchedAt: Date.now() }, ...s.history.filter((h) => h.id !== entry.id)].slice(0, 100),
        })),
      removeFromHistory: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
      clearHistory: () => set({ history: [] }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'anime-premium-store',
      version: 1,
      // v0 → v1: settings gained autoSkip / autoNext, progress map added.
      migrate: (persisted) => {
        const state = persisted as Partial<AppState>;
        return {
          ...state,
          progress: state.progress ?? {},
          settings: { defaultLang: 'vostfr', autoSkip: false, autoNext: true, ...state.settings },
        } as AppState;
      },
    }
  )
);

/** True once the persisted store has been read from localStorage (avoids hydration mismatch). */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false
  );
}
