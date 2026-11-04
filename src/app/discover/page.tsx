'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AnimeResults } from '@/components/anime/anime-results';
import { fetchAniList, BROWSE_ANIMES } from '@/core/api/anilist';
import type { AnimeSummary } from '@/lib/anime';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Compass, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Labels FR -> genres AniList (les valeurs doivent correspondre exactement à l'API).
const GENRES: { label: string; value: string }[] = [
  { label: 'Action', value: 'Action' },
  { label: 'Aventure', value: 'Adventure' },
  { label: 'Comédie', value: 'Comedy' },
  { label: 'Drame', value: 'Drama' },
  { label: 'Fantasy', value: 'Fantasy' },
  { label: 'Romance', value: 'Romance' },
  { label: 'Sci-Fi', value: 'Sci-Fi' },
  { label: 'Horreur', value: 'Horror' },
  { label: 'Mystère', value: 'Mystery' },
  { label: 'Slice of Life', value: 'Slice of Life' },
  { label: 'Sport', value: 'Sports' },
  { label: 'Surnaturel', value: 'Supernatural' },
  { label: 'Thriller', value: 'Thriller' },
  { label: 'Mecha', value: 'Mecha' },
];

const SORTS = [
  { label: 'Populaires', value: 'POPULARITY_DESC' },
  { label: 'Tendances', value: 'TRENDING_DESC' },
  { label: 'Mieux notés', value: 'SCORE_DESC' },
  { label: 'Récents', value: 'START_DATE_DESC' },
];

export default function DiscoverPage() {
  const [genre, setGenre] = useState(GENRES[0].value);
  const [sort, setSort] = useState(SORTS[0].value);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['discover', genre, sort],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await fetchAniList(BROWSE_ANIMES, { genre, sort: [sort], page: pageParam, perPage: 30 });
      return {
        media: (res?.Page?.media ?? []) as AnimeSummary[],
        hasNext: !!res?.Page?.pageInfo?.hasNextPage,
        page: pageParam,
      };
    },
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });

  const animes = data?.pages.flatMap((p) => p.media);

  const chip = (active: boolean) =>
    `px-5 py-2 rounded-full border font-medium transition-colors whitespace-nowrap cursor-pointer ${
      active ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
    }`;

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-10 pb-32">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
            <Compass className="w-8 h-8 text-primary" />
            Découvrir
          </h1>
          <Link
            href="/calendar"
            className="md:hidden flex items-center gap-2 h-11 px-4 rounded-full bg-white/10 border border-white/10 text-white text-sm font-semibold"
          >
            <CalendarDays className="w-4 h-4" /> Calendrier
          </Link>
        </div>

        <div className="flex gap-3 mb-4 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Genres">
          {GENRES.map((g) => (
            <button key={g.value} role="tab" aria-selected={genre === g.value} onClick={() => setGenre(g.value)} className={chip(genre === g.value)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none text-sm" aria-label="Tri">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              aria-pressed={sort === s.value}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                sort === s.value ? 'bg-white/20 text-white' : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <AnimeResults animes={animes} isLoading={isLoading} error={error} emptyMessage="Aucun anime trouvé pour ce genre." />

        {hasNextPage && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Chargement…' : 'Voir plus'}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
