/** Admin panel (/admin) helpers. Pure module (no imports) so `node --test` can load it. */

export type AnimeQuery = { id: number } | { search: string };

/** What the admin typed to find an anime: an AniList id, an AniList / SAKURA link, or a title. */
export function parseAnimeQuery(input: string): AnimeQuery | null {
  const text = input.trim();
  if (!text) return null;
  const id = /^\d{1,9}$/.test(text) ? text : (/anilist\.co\/anime\/(\d{1,9})/.exec(text)?.[1] ?? /\/anime\?(?:.*&)?id=(\d{1,9})/.exec(text)?.[1]);
  const n = id ? Number(id) : 0;
  return n > 0 ? { id: n } : { search: text };
}

export interface AdminUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_id: string | null;
  is_public: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  banners: number;
  trophies: number;
}

export interface AdminBanner {
  anime_id: number;
  banner_url: string;
  title: string | null;
  is_trophy: boolean;
  unlocked_at: string;
}

export interface AdminStats {
  users: number;
  public_profiles: number;
  banners: number;
  trophies: number;
}
