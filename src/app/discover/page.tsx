'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AnimeResults } from '@/components/anime/anime-results';
import { fetchAniList, BROWSE_ANIMES } from '@/core/api/anilist';
import type { AnimeSummary } from '@/lib/anime';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Compass, CalendarDays } from '@/components/ui/icons';
import Link from 'next/link';
import { haptic } from '@/lib/haptics';
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
    `shrink-0 px-4 md:px-5 h-10 rounded-full border text-[15px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
      active ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
    }`;

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-page pb-32">
        <div className="flex items-center justify-between gap-3 mb-6 md:mb-8 max-md:pr-28">
          <h1 className="text-[34px] md:text-5xl font-bold text-white flex items-center gap-3 md:gap-4 min-w-0" style={{ fontFamily: 'var(--font-impact)' }}>
            <Compass className="w-7 h-7 md:w-8 md:h-8 text-sakura shrink-0" />
            Découvrir
          </h1>
          {/* Phones: same row, size and material as the floating account button (right-4), just left of it. */}
          <Link
            href="/calendar"
            aria-label="Calendrier des sorties"
            title="Calendrier"
            className="md:hidden fixed z-40 right-[68px] top-[max(var(--safe-top),16px)] w-11 h-11 rounded-full tab-bar-glass float-glass text-white/90 flex items-center justify-center active:scale-95 transition-transform"
          >
            <CalendarDays className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex gap-2 md:gap-3 mb-4 overflow-x-auto pb-2 scrollbar-none -mx-6 px-6 md:mx-0 md:px-0" role="tablist" aria-label="Genres">
          {GENRES.map((g) => (
            <button key={g.value} role="tab" aria-selected={genre === g.value} onClick={() => {
                haptic('selection');
                setGenre(g.value);
              }} className={chip(genre === g.value)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 md:inline-grid md:w-auto gap-1 p-1 mb-6 md:mb-8 rounded-xl bg-white/[0.06] text-[13px] md:text-sm" role="group" aria-label="Tri">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                haptic('selection');
                setSort(s.value);
              }}
              aria-pressed={sort === s.value}
              className={`h-9 px-2 md:px-4 rounded-lg whitespace-nowrap font-semibold transition-colors cursor-pointer ${
                sort === s.value ? 'bg-white/20 text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'
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
