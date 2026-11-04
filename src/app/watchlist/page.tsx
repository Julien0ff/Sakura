'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AnimeCard, AnimeGridSkeleton, animeGridClass } from '@/components/anime/anime-card';
import { useAppStore, useHydrated } from '@/core/store';
import { Bookmark } from 'lucide-react';
import Link from 'next/link';

export default function WatchlistPage() {
  const hydrated = useHydrated();
  const watchlist = useAppStore((s) => s.watchlist);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-10 pb-32">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
          <Bookmark className="w-8 h-8 text-primary" />
          Ma Liste
        </h1>

        {!hydrated ? (
          <AnimeGridSkeleton count={6} />
        ) : watchlist.length === 0 ? (
          <div className="mt-12 text-center text-[#8E8E93] py-20 space-y-4">
            <p className="text-lg">Votre liste est vide.</p>
            <p>
              Ajoutez des animes avec le bouton « Ma liste » sur leur page.{' '}
              <Link href="/discover" className="text-white underline underline-offset-4 hover:text-primary">Découvrir des animes</Link>
            </p>
          </div>
        ) : (
          <div className={animeGridClass}>
            {watchlist.map((a) => (
              <AnimeCard key={a.id} id={a.id} title={a.title} cover={a.cover} status={a.status} score={a.score} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
