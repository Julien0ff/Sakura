'use client';

import { AnimeCard } from '@/components/anime/anime-card';
import { RowScroller } from '@/components/home/row-scroller';
import { useAppStore, useHydrated } from '@/core/store';

export function ContinueWatchingRow() {
  const hydrated = useHydrated();
  const history = useAppStore((s) => s.history);

  if (!hydrated || history.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="px-6 md:pl-32 text-[22px] font-bold tracking-tight text-white mb-4">Reprendre</h2>
      <RowScroller>
        {history.slice(0, 15).map((h) => (
          <AnimeCard
            key={h.id}
            id={h.id}
            title={h.title}
            cover={h.cover}
            color={h.color}
            subtitle={`${h.season > 1 ? `S${h.season} · ` : ''}Épisode ${h.episodeNumber} · ${h.lang.toUpperCase()}`}
            className="min-w-[160px] md:min-w-[200px] w-[160px] md:w-[200px] snap-start"
          />
        ))}
      </RowScroller>
    </section>
  );
}
