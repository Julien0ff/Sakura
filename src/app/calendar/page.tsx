'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { fetchAniList, AIRING_SCHEDULE } from '@/core/api/anilist';
import { useAppStore, useHydrated } from '@/core/store';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface AiringItem {
  id: number;
  episode: number;
  airingAt: number;
  media: {
    id: number;
    isAdult: boolean;
    countryOfOrigin: string;
    popularity: number;
    title: { romaji?: string; english?: string };
    coverImage: { large?: string; color?: string };
    format?: string;
  };
}

const DAY = 86400;
const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function fetchWeek(from: number, to: number) {
  const items: AiringItem[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetchAniList(AIRING_SCHEDULE, { page, from, to });
    items.push(...(res?.Page?.airingSchedules ?? []));
    if (!res?.Page?.pageInfo?.hasNextPage) break;
  }
  // Japanese TV anime only, no adult content, and drop very obscure entries.
  return items.filter((i) => !i.media.isAdult && i.media.countryOfOrigin === 'JP' && i.media.popularity > 500);
}

export default function CalendarPage() {
  const [today] = useState(() => startOfDay());
  // Captured once per mount; good enough to mark episodes as already aired.
  const [now] = useState(() => Date.now() / 1000);
  const [selected, setSelected] = useState(0); // 0 = today … 6
  const hydrated = useHydrated();
  const watchlistIds = useAppStore((s) => s.watchlist.map((a) => a.id).join(','));
  const tabsRef = useRef<HTMLDivElement>(null);

  const from = Math.floor(today.getTime() / 1000);
  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar', from],
    queryFn: () => fetchWeek(from, from + 7 * DAY),
    staleTime: 15 * 60 * 1000,
  });

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selected]);

  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY * 1000));
  const dayStart = from + selected * DAY;
  const followed = new Set(hydrated ? watchlistIds.split(',').filter(Boolean).map(Number) : []);
  const items = (data ?? [])
    .filter((i) => i.airingAt >= dayStart && i.airingAt < dayStart + DAY)
    // Shows from "Ma liste" first, then by time.
    .sort((a, b) => Number(followed.has(b.media.id)) - Number(followed.has(a.media.id)) || a.airingAt - b.airingAt);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-10 pb-32">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
          <CalendarDays className="w-8 h-8 text-primary" />
          Calendrier
        </h1>

        <div ref={tabsRef} role="tablist" aria-label="Jour" className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {days.map((d, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={selected === i}
              onClick={() => setSelected(i)}
              className={`shrink-0 flex flex-col items-center min-w-[84px] px-4 py-2.5 rounded-2xl border transition-colors cursor-pointer ${
                selected === i ? 'bg-white text-black border-white' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="text-sm font-semibold capitalize">{i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : dayFmt.format(d)}</span>
              <span className={`text-xs ${selected === i ? 'text-black/60' : 'text-[#8E8E93]'}`}>{dateFmt.format(d)}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3 max-w-3xl">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-center text-red-400 py-20">Impossible de charger le calendrier. Réessayez dans un instant.</p>
        ) : items.length === 0 ? (
          <p className="text-center text-[#8E8E93] text-lg py-20">Aucune sortie prévue ce jour-là.</p>
        ) : (
          <ol className="space-y-3 max-w-3xl">
            {items.map((item) => {
              const title = item.media.title.english || item.media.title.romaji;
              const aired = item.airingAt <= now;
              const isFollowed = followed.has(item.media.id);
              return (
                <li key={item.id}>
                  <Link
                    href={`/anime?id=${item.media.id}`}
                    className={`flex items-center gap-4 p-3 rounded-2xl border transition-colors ${
                      isFollowed ? 'bg-white/10 border-white/15' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <time
                      dateTime={new Date(item.airingAt * 1000).toISOString()}
                      className={`w-14 shrink-0 text-center font-bold tabular-nums ${aired ? 'text-[#8E8E93]' : 'text-white'}`}
                    >
                      {timeFmt.format(item.airingAt * 1000)}
                    </time>
                    {item.media.coverImage.large && (
                      <img src={item.media.coverImage.large} alt="" loading="lazy" className="w-12 aspect-[2/3] object-cover rounded-lg shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{title}</div>
                      <div className="text-sm text-[#8E8E93] flex items-center gap-2">
                        <span>Épisode {item.episode}</span>
                        {isFollowed && <span className="px-1.5 py-0.5 rounded bg-white/15 text-white text-[11px] font-semibold">Ma liste</span>}
                        {aired && <span className="text-[11px] font-semibold text-[#30D158]">Disponible</span>}
                      </div>
                    </div>
                    <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: item.media.coverImage.color || 'transparent' }} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </AppLayout>
  );
}
