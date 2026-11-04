export interface AnimeSummary {
  id: number;
  title: { romaji?: string | null; english?: string | null; native?: string | null };
  coverImage: { extraLarge?: string | null; large?: string | null; color?: string | null };
  bannerImage?: string | null;
  description?: string | null;
  episodes?: number | null;
  status?: string | null;
  format?: string | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  genres?: string[];
}

const STATUS_LABELS: Record<string, string> = {
  RELEASING: 'En cours',
  FINISHED: 'Terminé',
  NOT_YET_RELEASED: 'À venir',
  CANCELLED: 'Annulé',
  HIATUS: 'En pause',
};

export function statusLabel(status?: string | null, fallback = 'TV') {
  return (status && STATUS_LABELS[status]) || fallback;
}

/** AniList scores are /100; returns "8.4" or null when unrated. */
export function formatScore(score?: number | null) {
  return typeof score === 'number' && score > 0 ? (score / 10).toFixed(1) : null;
}

export function animeTitle(anime: Pick<AnimeSummary, 'title'>) {
  return anime.title.english || anime.title.romaji || anime.title.native || 'Sans titre';
}

export function coverUrl(anime: Pick<AnimeSummary, 'coverImage'>) {
  return anime.coverImage.extraLarge || anime.coverImage.large || '';
}
