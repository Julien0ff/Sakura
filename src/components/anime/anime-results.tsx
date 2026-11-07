'use client';

import { AnimeCard, AnimeGridSkeleton, animeGridClass } from '@/components/anime/anime-card';
import { animeTitle, coverUrl, type AnimeSummary } from '@/lib/anime';

interface AnimeResultsProps {
  animes?: AnimeSummary[];
  isLoading: boolean;
  error?: unknown;
  emptyMessage: string;
}

export function AnimeResults({ animes, isLoading, error, emptyMessage }: AnimeResultsProps) {
  if (isLoading) return <AnimeGridSkeleton />;
  if (error) {
    return <p className="text-center text-red-400 py-20">Erreur lors du chargement. Réessayez dans un instant.</p>;
  }
  if (!animes?.length) {
    return <p className="text-center text-[#8E8E93] text-lg py-20">{emptyMessage}</p>;
  }
  return (
    <div className={animeGridClass}>
      {animes.map((anime) => (
        <AnimeCard
          key={anime.id}
          id={anime.id}
          title={animeTitle(anime)}
          cover={coverUrl(anime)}
          status={anime.status}
          score={anime.averageScore}
          color={anime.coverImage.color}
        />
      ))}
    </div>
  );
}
