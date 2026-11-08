'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AnimeResults } from '@/components/anime/anime-results';
import { searchAnime } from '@/core/api/search';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search as SearchIcon, X } from '@/components/ui/icons';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SearchPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

function Search() {
  // The query lives in the URL (?q=): « back » from an anime page brings the search back.
  const initial = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial.trim());

  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      setDebounced(q);
      const url = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
      if (url !== `${location.pathname}${location.search}`) window.history.replaceState(null, '', url);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching, error } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchAnime(debounced),
    staleTime: 5 * 60 * 1000,
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-page pb-32">
        <h1 className="text-4xl md:text-5xl font-bold text-sakura mb-8 max-md:pr-12 flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
          <SearchIcon className="w-8 h-8 text-sakura" />
          Recherche
        </h1>

        <div className="relative max-w-2xl mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-[#8E8E93]" />
          </div>
          <input
            type="search"
            autoFocus={!initial}
            aria-label="Rechercher un anime"
            className="block w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-sakura focus:border-transparent transition-all [&::-webkit-search-cancel-button]:hidden"
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
