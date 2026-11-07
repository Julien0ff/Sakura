'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark } from '@/components/ui/icons';
import { AppLayout } from '@/components/layout/app-layout';
import { AnimeCard, AnimeGridSkeleton, animeGridClass } from '@/components/anime/anime-card';
import { useAppStore, useHydrated } from '@/core/store';
import { LIST_STATUSES, STATUS_LABELS, isListStatus, type ListStatus } from '@/core/tracking';
import { haptic } from '@/lib/haptics';

const EMPTY: Record<ListStatus | 'all', string> = {
  all: 'Votre liste est vide.',
  planned: 'Rien à voir pour l’instant.',
  watching: 'Aucun anime en cours.',
  paused: 'Aucun anime en pause.',
  completed: 'Aucun anime terminé.',
  dropped: 'Aucun anime abandonné.',
};

function Watchlist() {
  const hydrated = useHydrated();
  const watchlist = useAppStore((s) => s.watchlist);
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('status');
  const filter: ListStatus | 'all' = isListStatus(raw) ? raw : 'all';

  const counts = useMemo(() => {
    const c = Object.fromEntries(LIST_STATUSES.map((s) => [s, 0])) as Record<ListStatus, number>;
    for (const a of watchlist) c[a.listStatus] += 1;
    return c;
  }, [watchlist]);
  const shown = filter === 'all' ? watchlist : watchlist.filter((a) => a.listStatus === filter);

  const chip = (value: ListStatus | 'all', label: string, count: number) => (
    <button
      key={value}
      type="button"
      role="tab"
      aria-selected={filter === value}
      onClick={() => {
        haptic('selection');
        router.replace(value === 'all' ? '/watchlist' : `/watchlist?status=${value}`, { scroll: false });
      }}
      className={`shrink-0 h-10 px-4 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
        filter === value ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
      }`}
    >
      {label} <span className={filter === value ? 'text-black/50' : 'text-white/40'}>{count}</span>
    </button>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-10 pb-32">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 max-md:pr-12 flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
        <Bookmark className="w-8 h-8 text-sakura" />
        Ma Liste
      </h1>

      <div role="tablist" aria-label="Filtrer par statut" className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-6 -mx-6 px-6 md:mx-0 md:px-0">
        {chip('all', 'Tout', watchlist.length)}
        {LIST_STATUSES.map((s) => chip(s, STATUS_LABELS[s], counts[s]))}
      </div>

      {!hydrated ? (
        <AnimeGridSkeleton count={6} />
      ) : shown.length === 0 ? (
        <div className="mt-12 text-center text-[#8E8E93] py-20 space-y-4">
          <p className="text-lg">{EMPTY[filter]}</p>
          <p>
            Ajoutez des animes avec le bouton « Ma liste » sur leur page.{' '}
            <Link href="/discover" className="text-white underline underline-offset-4 hover:text-primary">Découvrir des animes</Link>
          </p>
        </div>
      ) : (
        <div className={animeGridClass}>
          {shown.map((a) => (
            <AnimeCard
              key={a.id}
              id={a.id}
              title={a.title}
              cover={a.cover}
              status={a.status}
              score={a.score}
              color={a.color}
              badge={filter === 'all' ? STATUS_LABELS[a.listStatus] : undefined}
              subtitle={a.rating ? `Ma note : ${a.rating}/10` : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <AppLayout>
      <Suspense fallback={null}>
        <Watchlist />
      </Suspense>
    </AppLayout>
  );
}
