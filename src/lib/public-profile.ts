import type { BlockId } from '@/core/tracking';
import type { ListStatus } from '@/core/tracking';

/** Shape returned by the `get_public_profile` RPC (supabase/migrations/…profile_tracking.sql). */
export interface ProfileItem {
  anime_id: number;
  title: string | null;
  cover: string | null;
  color: string | null;
  list_status?: ListStatus;
  rating: number | null;
  episode?: number | null;
  season?: number | null;
  completed_on_sakura?: boolean;
}

export interface ProfileStats {
  completed: number;
  watching: number;
  hours: number;
  avg_rating: number | null;
}

export type ProfileBlock =
  | { id: 'stats'; visible: boolean; stats: ProfileStats }
  | { id: Exclude<BlockId, 'stats'>; visible: boolean; items: ProfileItem[] };

export interface PublicProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_public: boolean;
  is_owner: boolean;
  banner: { id: string | null; url: string | null; title: string | null };
  trophies: { anime_id: number; title: string | null; banner_url: string }[];
  blocks: ProfileBlock[];
}
