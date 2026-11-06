'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AnimeResults } from '@/components/anime/anime-results';
import { fetchAniList, BROWSE_ANIMES } from '@/core/api/anilist';
import type { AnimeSummary } from '@/lib/anime';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching, error } = useQuery({
    queryKey: ['search', debounced],
    queryFn: async () => {
      const res = await fetchAniList(BROWSE_ANIMES, { search: debounced, page: 1, perPage: 30, sort: ['SEARCH_MATCH', 'POPULARITY_DESC'] });
      return (res?.Page?.media ?? []) as AnimeSummary[];
    },
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-10 pb-32">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 max-md:pr-12" style={{ fontFamily: 'var(--font-impact)' }}>
          Recherche
        </h1>

        <div className="relative max-w-2xl mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-[#8E8E93]" />
          </div>
          <input
            type="search"
            autoFocus
            aria-label="Rechercher un anime"
            className="block w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all [&::-webkit-search-cancel-button]:hidden"
            placeholder="Rechercher un anime, un film..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Effacer"
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#8E8E93] hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {debounced.length < 2 ? (
          <p className="text-center text-[#8E8E93] text-lg py-20">Tapez au moins 2 caractères pour lancer la recherche.</p>
        ) : (
          <AnimeResults
            animes={data}
            isLoading={isFetching && !data}
            error={error}
            emptyMessage={`Aucun résultat pour « ${debounced} ».`}
          />
        )}
      </div>
    </AppLayout>
  );
}
