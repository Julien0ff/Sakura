'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAniList, GET_TRENDING_ANIMES } from '@/core/api/anilist';
import { getTMDBDetails } from '@/core/api/tmdb';
import { cartoonSummary, discoverQuery, type TmdbCartoon } from '@/lib/cartoons';
import { Play, Info, Star } from '@/components/ui/icons';
import Link from 'next/link';
import { formatScore, statusLabel, type AnimeSummary } from '@/lib/anime';
import { useAmbientColor } from '@/lib/use-ambient-color';
import { readableOn } from '@/lib/color';
import { haptic } from '@/lib/haptics';

const SLIDE_MS = 7000;

/** AniList descriptions contain HTML (<br>, <i>…); render them as plain text. */
function plainText(html?: string | null) {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function HeroBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hero-animes'],
    queryFn: async () => {
      const [aniData, cartoonRes] = await Promise.all([
        fetchAniList(GET_TRENDING_ANIMES, { page: 1, perPage: 5 }).catch(() => null),
        fetch(`/api/tmdb/discover/tv?${discoverQuery('POPULARITY_DESC', 1)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      const media = ((aniData?.Page?.media ?? []) as AnimeSummary[]).slice(0, 5);
      const enrichedAnimes = await Promise.all(
        media.map(async (anime) => {
          const tmdb = await getTMDBDetails(anime.title.english || anime.title.romaji || '', anime.seasonYear);
          return {
            ...anime,
            title: { ...anime.title, english: tmdb?.title || anime.title.english },
            description: tmdb?.description || anime.description,
          };
        })
      );

      // Top popular cartoons with high-res backdrop
      const rawCartoons: TmdbCartoon[] = cartoonRes?.results ?? [];
      const cartoonBanners: AnimeSummary[] = rawCartoons
        .slice(0, 4)
        .map(cartoonSummary)
        .filter((c) => Boolean(c.bannerImage)) as unknown as AnimeSummary[];

      // Interleave: [anime, cartoon, anime, cartoon, anime...]
      const combined: AnimeSummary[] = [];
      let cIdx = 0;
      for (let i = 0; i < enrichedAnimes.length; i++) {
        combined.push(enrichedAnimes[i]);
        if (i % 2 === 0 && cIdx < cartoonBanners.length) {
          combined.push(cartoonBanners[cIdx++]);
        }
      }
      return combined.length > 0 ? combined : enrichedAnimes;
    },
    staleTime: 10 * 60 * 1000,
  });

  const animes = data ?? [];
  const count = animes.length;
  const active = animes[currentIndex];
  const activeColor = active?.coverImage.color || '#0A84FF';

  useAmbientColor(active ? activeColor : null);

  const goTo = useCallback((i: number) => setCurrentIndex(((i % count) + count) % count), [count]);

  // Auto-advance. Restarts after every manual change; pauses while keyboard focus is inside
  // (not on mouse hover: passing the pointer over the banner shouldn't freeze it),
  // in background tabs and when the user prefers reduced motion.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => {
      if (!document.hidden) setCurrentIndex((p) => (p + 1) % count);
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [count, paused, currentIndex]);

  if (isLoading || count === 0) {
    return <div className="relative w-full h-[72svh] min-h-[440px] md:h-[75vh] md:min-h-[560px] max-h-[850px] mb-6 bg-white/5 animate-pulse md:rounded-b-[48px]" />;
  }

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une"
      className="relative w-full h-[72svh] min-h-[440px] md:h-[75vh] md:min-h-[560px] max-h-[850px] mb-2 md:mb-10 overflow-hidden md:rounded-b-[48px] md:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]"
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches(':focus-visible')) setPaused(true);
      }}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 50) {
          haptic('selection');
          goTo(currentIndex + (dx < 0 ? 1 : -1));
        }
      }}
    >
      {animes.map((anime, index) => {
        const isActive = index === currentIndex;
        const title = anime.title.english || anime.title.romaji || '';
        const rating = formatScore(anime.averageScore);
        const color = anime.coverImage.color || '#0A84FF';
        const wide = anime.bannerImage || anime.coverImage.extraLarge || undefined;
        const tall = anime.coverImage.extraLarge || wide;

        return (
          <div
            key={anime.id}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${index + 1} sur ${count} : ${title}`}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            {/* Image: portrait cover on phones, wide banner from md. On phones the bottom edge
                dissolves into the page (.hero-fade, on the <img> itself — see globals.css); on desktop the card keeps its rounded corners. */}
            <div data-sd="media" className="absolute inset-0">
            <div data-sd="parallax" className="absolute inset-0">
              <picture>
                <source media="(min-width: 768px)" srcSet={wide} />
                <img
                  src={tall}
                  alt=""
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  className={`hero-fade absolute inset-0 w-full h-full object-cover object-[center_20%] md:object-center transition-transform duration-[7000ms] ease-linear ${isActive ? 'scale-105' : 'scale-100'}`}
                />
              </picture>
            </div>
            </div>

            {/* Legibility: top scrim for the status bar, side scrim on desktop, bottom fade into the page tinted with the anime color. */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
            <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-black/85 via-black/30 to-transparent" />
            {/* Text scrim. Transparent at both ends: the bottom edge must match the page behind
                (ambient color on black), otherwise a seam appears where the banner ends. */}
            <div
              className="absolute inset-x-0 bottom-0 h-[75%] md:hidden"
              style={{
                background: `linear-gradient(to top, transparent 0%, color-mix(in oklab, ${color} 10%, rgba(0,0,0,0.5)) 25%, rgba(0,0,0,0.25) 60%, transparent 100%)`,
              }}
            />
            {/* Desktop: the card has an edge, so the scrim can go fully dark at the bottom (best contrast). */}
            <div
              className="absolute inset-x-0 bottom-0 h-[65%] hidden md:block"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,0.92) 0%, color-mix(in oklab, ${color} 12%, rgba(0,0,0,0.6)) 35%, transparent 100%)`,
              }}
            />

            {/* Content */}
            <div data-sd="content" className="absolute inset-x-0 bottom-0 z-20 px-5 pb-16 md:pb-[9%] md:pl-32 md:pr-10 md:w-2/3 lg:w-1/2">
              {/* Text leaves fast and arrives after the image crossfade, so two titles never overlap. */}
              <div
                className={`flex flex-col gap-3 md:gap-5 transition-all ease-out ${
                  isActive ? 'opacity-100 translate-y-0 duration-700 delay-300' : 'opacity-0 translate-y-3 duration-200'
                }`}
              >
              <h2
                className="text-[40px] leading-[0.95] sm:text-5xl lg:text-[64px] font-bold text-white drop-shadow-2xl line-clamp-2 text-balance"
                style={{ fontFamily: 'var(--font-impact)' }}
              >
                {title}
              </h2>

              <div className="flex items-center gap-3 text-[13px]">
                <span
                  className="font-semibold tracking-wide text-white px-2 py-1 rounded-md backdrop-blur-md border"
                  style={{ backgroundColor: `${color}40`, borderColor: `${color}80` }}
                >
                  {statusLabel(anime.status)}
                </span>
                {rating && (
                  <span className="font-bold text-white flex items-center gap-1 drop-shadow-md">
                    <Star className="w-4 h-4" style={{ color }} aria-hidden /> {rating}
                  </span>
                )}
                {anime.genres?.slice(0, 2).map((g) => (
                  <span key={g} className="hidden sm:inline text-white/70 font-medium">{g}</span>
                ))}
              </div>

              <p className="text-[#EBEBF5]/90 text-[15px] md:text-[17px] leading-relaxed line-clamp-2 md:line-clamp-3 max-w-2xl drop-shadow-md">
                {plainText(anime.description)}
              </p>

              <div className="flex items-center gap-3 mt-1 md:mt-3">
                <Link
                  href={`/anime?id=${anime.id}&play=1`}
                  onClick={() => haptic('medium')}
                  tabIndex={isActive ? 0 : -1}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 text-white h-12 md:h-auto md:px-8 md:py-3.5 rounded-full font-bold text-[16px] md:text-[17px] hover:scale-105 active:scale-[0.98] transition-transform duration-300 shadow-xl"
                  style={{ backgroundColor: color, color: readableOn(color), boxShadow: `0 10px 30px -8px ${color}` }}
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                  Lecture
                </Link>
                <Link
                  href={`/anime?id=${anime.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 liquid-glass text-white h-12 md:h-auto md:px-8 md:py-3.5 rounded-full font-semibold text-[16px] md:text-[17px] hover:bg-white/15 active:scale-[0.98] transition-all duration-300"
                >
                  <Info className="w-5 h-5" />
                  Détails
                </Link>
              </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Pagination: centred on phones, bottom-right on desktop. Each dot has a 44px hit area. */}
      <div className="absolute bottom-3 md:bottom-6 inset-x-0 md:inset-x-auto md:right-12 flex justify-center items-center z-30">
        {animes.map((anime, idx) => (
          <button
            key={anime.id}
            onClick={() => {
              haptic('selection');
              goTo(idx);
            }}
            aria-label={`Afficher la diapositive ${idx + 1}`}
            aria-current={idx === currentIndex}
            className="group h-11 px-1.5 flex items-center cursor-pointer"
          >
            <span
              className={`block h-1.5 rounded-full overflow-hidden transition-all duration-300 ${
                idx === currentIndex ? 'w-8 bg-white/30' : 'w-1.5 bg-white/40 group-hover:bg-white/70'
              }`}
            >
              {idx === currentIndex && (
                <span
                  key={`${currentIndex}-${paused}`}
                  className="block h-full bg-white rounded-full"
                  style={{ animation: paused ? 'none' : `hero-progress ${SLIDE_MS}ms linear forwards`, width: paused ? '100%' : undefined }}
                />
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
