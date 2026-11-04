'use client';

import { AnimeCard } from '@/components/anime/anime-card';
import { useAppStore, useHydrated } from '@/core/store';

export function ContinueWatchingRow() {
  const hydrated = useHydrated();
  const history = useAppStore((s) => s.history);

  if (!hydrated || history.length === 0) return null;

  return (
    <section className="mb-12 pl-6 md:pl-32">
      <h2 className="text-[22px] font-bold tracking-tight text-white mb-4">Reprendre</h2>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 pr-6 md:pr-10 snap-x snap-mandatory scrollbar-none">
        {history.slice(0, 15).map((h) => (
          <AnimeCard
            key={h.id}
            id={h.id}
            title={h.title}
            cover={h.cover}
            subtitle={`${h.season > 1 ? `S${h.season} · ` : ''}Épisode ${h.episodeNumber} · ${h.lang.toUpperCase()}`}
            className="min-w-[160px] md:min-w-[200px] w-[160px] md:w-[200px] snap-start"
          />
        ))}
      </div>
    </section>
  );
}
