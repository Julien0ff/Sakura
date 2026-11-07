'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { fetchAniList, AIRING_SCHEDULE } from '@/core/api/anilist';
import { useAppStore, useHydrated, type CalendarLang, type Lang } from '@/core/store';
import { parisToEpoch, type PlanningEntry } from '@/lib/planning';
import { LangTag } from '@/components/anime/lang-tag';
import { haptic } from '@/lib/haptics';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, CalendarDays } from '@/components/ui/icons';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface AiringItem {
  id: number | string;
  /** Unknown for VF releases (the French planning only gives the season). */
  episode: number | null;
  airingAt: number;
  /** VOSTFR: AniList (Japanese broadcast). VF: Anime-Sama planning (French dub). */
  lang: Lang;
  /** « Saison 2 »… when there is no episode number. */
  label?: string | null;
  /** Release day known, hour not announced. */
  timeUnknown?: boolean;
  /** Projected from last week's planning (French dubs air weekly). */
  estimated?: boolean;
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
  return items
    .filter((i) => !i.media.isAdult && i.media.countryOfOrigin === 'JP' && i.media.popularity > 500)
    .map((i) => ({ ...i, lang: i.lang ?? ('vostfr' as const) }));
}

type AniMedia = AiringItem['media'];

/** Resolves French-planning titles to AniList media (one aliased query, empty result when no match). */
async function resolveTitles(titles: string[]): Promise<Map<string, AniMedia>> {
  const out = new Map<string, AniMedia>();
  if (titles.length === 0) return out;
  const fields = 'id isAdult countryOfOrigin popularity format title { romaji english } coverImage { large color }';
  const vars = titles.map((_, i) => `$s${i}: String`).join(', ');
  const body = titles.map((_, i) => `a${i}: Page(perPage: 1) { media(search: $s${i}, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${fields} } }`).join('\n');
  const variables = Object.fromEntries(titles.map((t, i) => [`s${i}`, t]));
  const data = await fetchAniList(`query (${vars}) {\n${body}\n}`, variables);
  titles.forEach((t, i) => {
    const m = data?.[`a${i}`]?.media?.[0] as AniMedia | undefined;
    if (m && !m.isAdult) out.set(t, m);
  });
  return out;
}

/** French dubs for the 7 days from `from`: this week's planning, projected one week ahead for the rest. */
async function fetchVfWeek(from: number): Promise<AiringItem[]> {
  const res = await fetch('/api/planning');
  if (!res.ok) throw new Error('planning');
  const entries = ((await res.json()) as PlanningEntry[]).filter((e) => e.lang === 'vf');
  const media = await resolveTitles([...new Set(entries.map((e) => e.title))]);

  const toItem = (e: PlanningEntry, shiftDays: number): AiringItem | null => {
    // Unmatched on AniList: still listed, with the planning artwork and no link (id 0).
    const m: AniMedia | undefined =
      media.get(e.title) ??
      (e.image ? { id: 0, isAdult: false, countryOfOrigin: 'JP', popularity: 0, title: { romaji: e.title }, coverImage: { large: e.image } } : undefined);
    if (!m) return null;
    const at = parisToEpoch(e.date, e.time ?? '23:59') + shiftDays * DAY;
    return {
      id: `vf:${e.slug}:${e.label ?? ''}:${shiftDays}`,
      episode: null,
      airingAt: at,
      lang: 'vf',
      label: e.label,
      timeUnknown: !e.time,
      estimated: shiftDays > 0,
      media: { ...m, title: { ...m.title, english: e.title } },
    };
  };

  const items: AiringItem[] = [];
  const covered = new Set(entries.map((e) => e.date));
  for (const e of entries) {
    const item = toItem(e, 0);
    if (item) items.push(item);
    // Days after the planning week: assume the weekly slot repeats (postponed ones excluded).
    const next = new Date(`${e.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    if (!e.postponed && !covered.has(next.toISOString().slice(0, 10))) {
      const projected = toItem(e, 7);
      if (projected) items.push(projected);
    }
  }
  return items.filter((i) => i.airingAt >= from && i.airingAt < from + 7 * DAY);
}

const LANG_FILTERS: { value: CalendarLang; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'vostfr', label: 'VOSTFR' },
  { value: 'vf', label: 'VF' },
];

export default function CalendarPage() {
  const [today] = useState(() => startOfDay());
  // Captured once per mount; good enough to mark episodes as already aired.
  const [now] = useState(() => Date.now() / 1000);
  const [selected, setSelected] = useState(0); // 0 = today … 6
  const hydrated = useHydrated();
  const watchlistIds = useAppStore((s) => s.watchlist.map((a) => a.id).join(','));
  const storedLang = useAppStore((s) => s.settings.calendarLang ?? 'all');
  const updateSettings = useAppStore((s) => s.updateSettings);
  const langFilter: CalendarLang = hydrated ? storedLang : 'all';
  const tabsRef = useRef<HTMLDivElement>(null);

  const from = Math.floor(today.getTime() / 1000);
  const vostfr = useQuery({
    queryKey: ['calendar', from],
    queryFn: () => fetchWeek(from, from + 7 * DAY),
    staleTime: 15 * 60 * 1000,
    enabled: langFilter !== 'vf',
  });
  const vf = useQuery({
    queryKey: ['calendar-vf', from],
    queryFn: () => fetchVfWeek(from),
    staleTime: 30 * 60 * 1000,
    enabled: langFilter !== 'vostfr',
  });
  const sources = langFilter === 'all' ? [vostfr, vf] : langFilter === 'vf' ? [vf] : [vostfr];
  const isLoading = sources.some((q) => q.isLoading);
  // One failing source must not blank the other.
  const error = sources.every((q) => q.error) ? sources[0].error : null;
  const data = sources.flatMap((q) => q.data ?? []);

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selected]);

  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY * 1000));
  const followed = new Set(hydrated ? watchlistIds.split(',').filter(Boolean).map(Number) : []);
  const itemsFor = (dayIndex: number) => {
    const start = from + dayIndex * DAY;
    return (data ?? [])
      .filter((i) => i.airingAt >= start && i.airingAt < start + DAY)
      // Shows from "Ma liste" first, then by time.
      .sort((a, b) => Number(followed.has(b.media.id)) - Number(followed.has(a.media.id)) || a.airingAt - b.airingAt);
  };
  const dayLabel = (i: number, d: Date) => (i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : dayFmt.format(d));

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 md:pr-10 pt-10 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 max-md:pr-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
            <CalendarDays className="w-8 h-8 text-sakura" />
            Calendrier
          </h1>
          <div role="radiogroup" aria-label="Langue" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.06] text-sm w-full sm:w-auto">
            {LANG_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={langFilter === f.value}
                onClick={() => {
                  haptic('selection');
                  updateSettings({ calendarLang: f.value });
                }}
                className={`h-9 px-4 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  langFilter === f.value ? 'bg-white/20 text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="-mt-4 mb-6 text-[13px] text-[#8E8E93] leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-1">
          À votre heure locale ·
          {langFilter !== 'vf' && (
            <span>
              <LangTag lang="vostfr" className="align-[1px]" /> diffusion japonaise
            </span>
          )}
          {langFilter === 'all' && '·'}
          {langFilter !== 'vostfr' && (
            <span>
              <LangTag lang="vf" className="align-[1px]" /> sortie française (Anime-Sama)
            </span>
          )}
        </p>

        {/* Phones / tablets: one day at a time */}
        <div className="xl:hidden">
          <div ref={tabsRef} role="tablist" aria-label="Jour" className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
            {days.map((d, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={selected === i}
                onClick={() => {
                  haptic('selection');
                  setSelected(i);
                }}
                className={`shrink-0 flex flex-col items-center min-w-[84px] px-4 py-2.5 rounded-2xl border transition-colors cursor-pointer ${
                  selected === i ? 'bg-white text-black border-white' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="text-sm font-semibold capitalize">{dayLabel(i, d)}</span>
                <span className={`text-xs ${selected === i ? 'text-black/60' : 'text-[#8E8E93]'}`}>{dateFmt.format(d)}</span>
              </button>
            ))}
          </div>
          <DayList items={itemsFor(selected)} isLoading={isLoading} error={error} followed={followed} now={now} />
        </div>

        {/* Desktop: the whole week at a glance */}
        <div className="hidden xl:grid grid-cols-7 gap-3">
          {days.map((d, i) => {
            const dayItems = itemsFor(i);
            return (
              <section
                key={i}
                aria-label={`${dayLabel(i, d)} ${dateFmt.format(d)}`}
                className={`min-w-0 rounded-3xl p-2 ${i === 0 ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white/[0.025]'}`}
              >
                <header className="px-2 pt-2 pb-3">
                  <div className={`text-[15px] font-bold capitalize ${i === 0 ? 'text-white' : 'text-white/85'}`}>{dayLabel(i, d)}</div>
                  <div className="text-xs text-[#8E8E93]">
                    {dateFmt.format(d)}
                    {!isLoading && ` · ${dayItems.length} épisode${dayItems.length > 1 ? 's' : ''}`}
                  </div>
                </header>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }, (_, k) => (
                      <div key={k} className="h-[88px] rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : dayItems.length === 0 ? (
                  <p className="px-2 py-6 text-xs text-[#636366]">Aucune sortie.</p>
                ) : (
                  <ol className="space-y-2">
                    {dayItems.map((item) => (
                      <li key={item.id}>
                        <WeekCard item={item} followed={followed.has(item.media.id)} aired={item.airingAt <= now} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
        {error && <p className="hidden xl:block text-center text-red-400 py-10">Impossible de charger le calendrier. Réessayez dans un instant.</p>}
      </div>
    </AppLayout>
  );
}

/** Link to the anime page, or a plain block when the release isn't matched on AniList (id 0). */
function MaybeLink({ id, ...props }: { id: number; className: string; title?: string; children: React.ReactNode }) {
  return id ? <Link href={`/anime?id=${id}`} {...props} /> : <div {...props} />;
}

function DayList({
  items,
  isLoading,
  error,
  followed,
  now,
}: {
  items: AiringItem[];
  isLoading: boolean;
  error: unknown;
  followed: Set<number>;
  now: number;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 max-w-3xl">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-center text-red-400 py-20">Impossible de charger le calendrier. Réessayez dans un instant.</p>;
  if (items.length === 0) return <p className="text-center text-[#8E8E93] text-lg py-20">Aucune sortie prévue ce jour-là.</p>;

  return (
    <ol className="space-y-3 max-w-3xl">
      {items.map((item) => {
        const title = item.media.title.english || item.media.title.romaji;
        const aired = item.airingAt <= now;
        const isFollowed = followed.has(item.media.id);
        return (
          <li key={item.id}>
            <MaybeLink
              id={item.media.id}
              className={`flex items-center gap-4 p-3 rounded-2xl border transition-colors ${
                isFollowed ? 'bg-white/10 border-white/15' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
              }`}
            >
              <time
                dateTime={new Date(item.airingAt * 1000).toISOString()}
                className={`w-14 shrink-0 text-center font-bold tabular-nums ${aired ? 'text-[#8E8E93]' : 'text-white'}`}
              >
                {item.timeUnknown ? <span className="text-[#8E8E93]" title="Heure non annoncée">--:--</span> : timeFmt.format(item.airingAt * 1000)}
              </time>
              {item.media.coverImage.large && (
                <img src={item.media.coverImage.large} alt="" loading="lazy" className="w-12 aspect-[2/3] object-cover rounded-lg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white truncate">{title}</div>
                <div className="mt-0.5 text-sm text-[#8E8E93] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{item.episode != null ? `Épisode ${item.episode}` : item.label ?? 'Nouvel épisode'}</span>
                  <LangTag lang={item.lang} />
                  {isFollowed && <span className="px-1.5 py-[1px] rounded-md bg-white/15 text-white text-[10px] font-bold uppercase leading-4">Ma liste</span>}
                  {aired && !item.timeUnknown && <span className="text-[11px] font-semibold text-[#30D158]">Disponible</span>}
                  {item.estimated && <span className="text-[11px] text-[#8E8E93]" title="D’après le créneau de la semaine dernière">Estimé</span>}
                </div>
              </div>
              <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: item.media.coverImage.color || 'transparent' }} aria-hidden />
            </MaybeLink>
          </li>
        );
      })}
    </ol>
  );
}

function WeekCard({ item, followed, aired }: { item: AiringItem; followed: boolean; aired: boolean }) {
  const title = item.media.title.english || item.media.title.romaji;
  const color = item.media.coverImage.color || '#3A3A3C';
  return (
    <MaybeLink
      id={item.media.id}
      title={title}
      className={`group relative flex gap-2.5 p-2 rounded-2xl border transition-colors overflow-hidden ${
        followed ? 'bg-white/10 border-white/15' : 'bg-white/[0.04] border-transparent hover:bg-white/[0.09] hover:border-white/10'
      }`}
    >
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: color }} aria-hidden />
      {item.media.coverImage.large && (
        <img
          src={item.media.coverImage.large}
          alt=""
          loading="lazy"
          className="w-11 aspect-[2/3] object-cover rounded-lg shrink-0 ml-1 transition-transform duration-300 group-hover:scale-105"
        />
      )}
      <div className="min-w-0 flex-1">
        <time
          dateTime={new Date(item.airingAt * 1000).toISOString()}
          className={`block text-[12px] font-bold tabular-nums ${aired ? 'text-[#8E8E93]' : 'text-white'}`}
        >
          {item.timeUnknown ? <span className="text-[#8E8E93]" title="Heure non annoncée">--:--</span> : timeFmt.format(item.airingAt * 1000)}
          {aired && !item.timeUnknown && <span className="ml-1.5 font-semibold text-[#30D158]">●</span>}
          {item.estimated && <span className="ml-1.5 font-medium text-[#8E8E93]" title="D’après le créneau de la semaine dernière">estimé</span>}
        </time>
        <div className="text-[13px] font-semibold leading-snug text-white line-clamp-2">{title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-[#8E8E93]">{item.episode != null ? `Ép. ${item.episode}` : item.label ?? 'Nouvel ép.'}</span>
          <LangTag lang={item.lang} />
          {followed && (
            <span className="px-1 h-4 rounded bg-white/15 text-white inline-flex items-center" title="Dans Ma liste">
              <Bookmark className="w-2.5 h-2.5" aria-label="Dans Ma liste" />
            </span>
          )}
        </div>
      </div>
    </MaybeLink>
  );
}
