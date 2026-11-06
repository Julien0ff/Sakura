'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ListStatus } from './tracking';
import { DEFAULT_SETTINGS, STORE_VERSION, migrateStore } from './store-migrate';

/** What the UI knows about an anime when saving it. */
export interface AnimeRef {
  id: number;
  title: string;
  cover: string;
  color?: string | null;
  score?: number | null;
  status?: string | null;
}

export interface SavedAnime extends AnimeRef {
  /** Epoch ms of the last change (sync: newest wins). */
  updatedAt: number;
  listStatus: ListStatus;
  /** The user's own rating, 1–10. */
  rating?: number | null;
  /** Set when the last episode was watched on SAKURA (unlocks the banner). */
  completedOnSakuraAt?: number | null;
  favorite?: boolean;
}

export interface EpisodeRating {
  rating: number;
  updatedAt: number;
}

/** `watchedAt` doubles as the sync timestamp. */
export interface HistoryEntry extends AnimeRef {
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

/** `auto`: list on phones, cards from the md breakpoint. */
export type EpisodeView = 'cards' | 'list' | 'auto';

export type Settings = {
  defaultLang: Lang;
  autoSkip: boolean;
  autoNext: boolean;
  haptics: boolean;
  hapticIntensity: 'soft' | 'normal' | 'strong';
  episodeView: EpisodeView;
};

/** Tombstone keys in `deleted`: a removal must reach the other devices. */
export const watchlistKey = (id: number) => `w:${id}`;
export const historyKey = (id: number) => `h:${id}`;
export const episodeRatingKey = (storeKey: string) => `r:${storeKey}`;

/** Everything the sync engine reads from / writes back to the store. */
export interface SyncSnapshot {
  watchlist: SavedAnime[];
  history: HistoryEntry[];
  progress: Record<string, EpisodeProgress>;
  /** Keyed like `progress` (`animeId:season:episode`). */
  episodeRatings: Record<string, EpisodeRating>;
  deleted: Record<string, number>;
  settings: Settings;
  settingsUpdatedAt: number;
}

interface AppState extends SyncSnapshot {
  saveProgress: (key: string, time: number, duration: number) => void;
  toggleWatchlist: (anime: AnimeRef) => void;
  /** `null` removes the anime from the list. */
  setListStatus: (anime: AnimeRef, status: ListStatus | null) => void;
  setAnimeRating: (id: number, rating: number | null) => void;
  /** Only one favorite: setting one clears the previous. */
  setFavorite: (id: number, favorite: boolean) => void;
  rateEpisode: (animeId: number, season: number, episode: number, rating: number | null) => void;
  markCompletedOnSakura: (id: number) => void;
  addToHistory: (entry: Omit<HistoryEntry, 'watchedAt'>) => void;
  removeFromHistory: (id: number) => void;
  clearHistory: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Sync: replace the synced slices with a merged snapshot. */
  replaceAll: (data: SyncSnapshot) => void;
  /** Sign-out: drop the account's data from this device (settings stay). */
  clearAccountData: () => void;
}

const without = (obj: Record<string, number>, key: string) => {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
};

// One-time migration of the pre-rename storage key, so nobody loses their list/history.
const STORE_KEY = 'sakura-store';
const LEGACY_STORE_KEY = 'anime-premium-store';
if (typeof window !== 'undefined') {
  const legacy = localStorage.getItem(LEGACY_STORE_KEY);
  if (legacy && !localStorage.getItem(STORE_KEY)) localStorage.setItem(STORE_KEY, legacy);
  if (legacy) localStorage.removeItem(LEGACY_STORE_KEY);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      watchlist: [],
      history: [],
      progress: {},
      episodeRatings: {},
      deleted: {},
      settings: DEFAULT_SETTINGS,
      settingsUpdatedAt: 0,
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
      toggleWatchlist: (anime) => get().setListStatus(anime, get().watchlist.some((a) => a.id === anime.id) ? null : 'planned'),
      setListStatus: (anime, status) =>
        set((s) => {
          const now = Date.now();
          const key = watchlistKey(anime.id);
          const existing = s.watchlist.find((a) => a.id === anime.id);
          if (status === null) {
            if (!existing) return {};
            return { watchlist: s.watchlist.filter((a) => a.id !== anime.id), deleted: { ...s.deleted, [key]: now } };
          }
          const entry: SavedAnime = existing
            ? { ...existing, ...pickRef(anime), listStatus: status, updatedAt: now }
            : { ...pickRef(anime), listStatus: status, updatedAt: now };
          return {
            watchlist: [entry, ...s.watchlist.filter((a) => a.id !== anime.id)],
            deleted: without(s.deleted, key),
          };
        }),
      setAnimeRating: (id, rating) =>
        set((s) => ({
          watchlist: s.watchlist.map((a) => (a.id === id ? { ...a, rating, updatedAt: Date.now() } : a)),
        })),
      setFavorite: (id, favorite) =>
        set((s) => {
          const now = Date.now();
          return {
            watchlist: s.watchlist.map((a) =>
              a.id === id ? { ...a, favorite, updatedAt: now } : favorite && a.favorite ? { ...a, favorite: false, updatedAt: now } : a
            ),
          };
        }),
      rateEpisode: (animeId, season, episode, rating) =>
        set((s) => {
          const k = progressKey(animeId, season, episode);
          const tomb = episodeRatingKey(k);
          const now = Date.now();
          if (rating === null) {
            if (!s.episodeRatings[k]) return {};
            const episodeRatings = { ...s.episodeRatings };
            delete episodeRatings[k];
            return { episodeRatings, deleted: { ...s.deleted, [tomb]: now } };
          }
          return { episodeRatings: { ...s.episodeRatings, [k]: { rating, updatedAt: now } }, deleted: without(s.deleted, tomb) };
        }),
      markCompletedOnSakura: (id) =>
        set((s) => ({
          watchlist: s.watchlist.map((a) => (a.id === id ? { ...a, completedOnSakuraAt: a.completedOnSakuraAt ?? Date.now(), updatedAt: Date.now() } : a)),
        })),
      // One entry per anime (latest episode watched), most recent first, capped at 100.
      addToHistory: (entry) =>
        set((s) => ({
          history: [{ ...entry, watchedAt: Date.now() }, ...s.history.filter((h) => h.id !== entry.id)].slice(0, 100),
          deleted: without(s.deleted, historyKey(entry.id)),
        })),
      removeFromHistory: (id) =>
        set((s) => ({
          history: s.history.filter((h) => h.id !== id),
          deleted: { ...s.deleted, [historyKey(id)]: Date.now() },
        })),
      clearHistory: () =>
        set((s) => {
          const now = Date.now();
          const deleted = { ...s.deleted };
          for (const h of s.history) deleted[historyKey(h.id)] = now;
          return { history: [], deleted };
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch }, settingsUpdatedAt: Date.now() })),
      replaceAll: (data) => set(data),
      clearAccountData: () => set({ watchlist: [], history: [], progress: {}, episodeRatings: {}, deleted: {} }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      migrate: (persisted, version) => migrateStore(persisted, version) as AppState,
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

/** Only the AnimeRef fields (callers sometimes pass richer objects). */
function pickRef(a: AnimeRef): AnimeRef {
  return { id: a.id, title: a.title, cover: a.cover, color: a.color, score: a.score, status: a.status };
}
