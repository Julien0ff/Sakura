'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAniList, BROWSE_ANIMES } from '@/core/api/anilist';
import { getTMDBFrenchTitle } from '@/core/api/tmdb';
import { AnimeCard } from '@/components/anime/anime-card';
import { RowScroller } from '@/components/home/row-scroller';
import { animeTitle, coverUrl, type AnimeSummary } from '@/lib/anime';

interface RowProps {
  title: string;
  /** AniList BROWSE_ANIMES variables (sort, season, seasonYear, genre…) */
  variables: Record<string, unknown>;
}

export function HorizontalRow({ title, variables }: RowProps) {
  const { data: animes, isLoading, error } = useQuery({
    queryKey: ['animes-row', variables],
    queryFn: async () => {
      const data = await fetchAniList(BROWSE_ANIMES, { page: 1, perPage: 15, ...variables });
      const media = (data?.Page?.media ?? []) as AnimeSummary[];
      // Prefer the French title from TMDB when one exists (Japanese results only, cached).
      return Promise.all(
        media.map(async (anime) => {
          const fr = await getTMDBFrenchTitle(animeTitle(anime));
          return fr ? { ...anime, title: { ...anime.title, english: fr } } : anime;
        })
      );
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="mb-12">
        <h2 className="px-6 md:pl-32 text-[22px] font-bold tracking-tight text-white mb-4">{title}</h2>
        <div className="flex gap-4 overflow-x-hidden px-6 md:pl-32">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="min-w-[160px] md:min-w-[200px] aspect-[2/3] bg-white/[0.03] apple-squircle animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error || !animes?.length) return null;

  return (
    <section className="mb-12 group/section">
      <div className="flex items-center justify-between mb-4 px-6 md:pl-32 md:pr-10">
        <h2 className="text-[22px] font-bold tracking-tight text-white">{title}</h2>
      </div>

      <RowScroller>
        {animes.map((anime) => (
          <AnimeCard
            key={anime.id}
            id={anime.id}
            title={animeTitle(anime)}
            cover={coverUrl(anime)}
            status={anime.status}
            score={anime.averageScore}
            color={anime.coverImage.color}
            className="min-w-[160px] md:min-w-[200px] w-[160px] md:w-[200px] snap-start"
          />
        ))}
      </RowScroller>
    </section>
  );
}
