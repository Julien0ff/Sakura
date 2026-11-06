/** Persisted-store migrations. Pure (type-only imports) so `node --test` can load it. */
import type { SavedAnime, Settings, SyncSnapshot } from './store.ts';
import { isListStatus } from './tracking.ts';

export const STORE_VERSION = 6;

export const DEFAULT_SETTINGS: Settings = { defaultLang: 'vostfr', autoSkip: false, autoNext: true, haptics: true, hapticIntensity: 'normal', episodeView: 'auto' };

/**
 * v0 → v1: settings gained autoSkip / autoNext, progress map added. v2–3: haptics.
 * v4: sync — watchlist updatedAt, tombstones, settingsUpdatedAt.
 * v5: tracking — every list entry gets a status (existing ones: « À voir »), episode ratings.
 * v6: settings.episodeView (defaults merged in below).
 */
export function migrateStore(persisted: unknown, _fromVersion: number): SyncSnapshot {
  const state = (persisted ?? {}) as Partial<SyncSnapshot> & { watchlist?: Partial<SavedAnime>[] };
  const now = Date.now();
  return {
    ...(state as object),
    watchlist: (state.watchlist ?? []).map(
      (a) => ({ ...a, updatedAt: a.updatedAt ?? now, listStatus: isListStatus(a.listStatus) ? a.listStatus : 'planned' }) as SavedAnime
    ),
    history: state.history ?? [],
    progress: state.progress ?? {},
    episodeRatings: state.episodeRatings ?? {},
    deleted: state.deleted ?? {},
    settings: { ...DEFAULT_SETTINGS, ...state.settings },
    settingsUpdatedAt: state.settingsUpdatedAt ?? 0,
  };
}
