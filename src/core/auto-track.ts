'use client';

import { useAppStore, type AnimeRef } from '@/core/store';
import { isFinalEpisode, nextStatusOnWatched } from '@/core/tracking';
import { isTrophy } from '@/lib/trophies';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/core/auth';
import { toast } from '@/components/ui/toast';

export interface TrackedAnime extends AnimeRef {
  anilistStatus?: string | null;
  anilistEpisodes?: number | null;
  tmdbSeasons?: { season_number: number; episode_count?: number }[] | null;
  bannerImage?: string | null;
  popularity?: number | null;
}

/** Called once when an episode crosses the "watched" threshold: auto status, completion, banner unlock. */
export function onEpisodeWatched(anime: TrackedAnime, season: number, episode: number) {
  const store = useAppStore.getState();
  const entry = store.watchlist.find((a) => a.id === anime.id);
  const next = nextStatusOnWatched(entry?.listStatus ?? null);
  if (next && next !== entry?.listStatus) store.setListStatus(anime, next);

  if (!isFinalEpisode({ anilistStatus: anime.anilistStatus, tmdbSeasons: anime.tmdbSeasons, anilistEpisodes: anime.anilistEpisodes, season, episode })) return;
  // Dropped stays dropped; anything else becomes completed (even a manual "completed": it is now earned).
  if (useAppStore.getState().watchlist.find((a) => a.id === anime.id)?.listStatus === 'dropped') return;
  store.setListStatus(anime, 'completed');
  store.markCompletedOnSakura(anime.id);
  void unlockBanner(anime);
}

/** Records the unlock (append-only table). Needs an account and an AniList banner. */
export async function unlockBanner(anime: TrackedAnime) {
  const session = useAuthStore.getState().session;
  const trophy = isTrophy(anime.id, anime.popularity);
  if (!supabase || !session || !anime.bannerImage) {
    toast(`${anime.title} terminé !`);
    return;
  }
  const { error } = await supabase
    .from('unlocked_banners')
    .upsert({ anime_id: anime.id, banner_url: anime.bannerImage, title: anime.title, is_trophy: trophy }, { onConflict: 'user_id,anime_id', ignoreDuplicates: true });
  toast(error ? `${anime.title} terminé !` : trophy ? `🏆 Trophée et bannière ${anime.title} débloqués` : `Bannière ${anime.title} débloquée`);
}
