'use client';

/* eslint-disable @next/next/no-img-element -- AniList banners / local SVGs */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, Crown, Lock } from '@/components/ui/icons';
import { toast } from '@/components/ui/toast';
import { useAppStore, isWatched } from '@/core/store';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BANNERS } from '@/lib/banners';
import { isTrophy } from '@/lib/trophies';
import { fetchAniList } from '@/core/api/anilist';
import { haptic } from '@/lib/haptics';

type Media = { id: number; bannerImage: string | null; episodes: number | null; popularity: number | null; title: { romaji: string; english: string | null } };

const BANNERS_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) { id bannerImage episodes popularity title { romaji english } }
  }
}`;

/** Famous anime (trophy-worthy) to show what can be earned beyond the user's own list. */
const TROPHY_SHOWCASE_QUERY = `
query {
  Page(perPage: 24) {
    media(type: ANIME, isAdult: false, sort: POPULARITY_DESC, format_in: [TV]) { id bannerImage episodes popularity title { romaji english } }
  }
}`;

const mediaTitle = (m: Media) => m.title.english || m.title.romaji;

type Tile = { id: string; url: string; label: string; trophy?: boolean };

const tileGrid = 'grid grid-cols-2 md:grid-cols-3 gap-2.5';
const sectionTitle = 'px-1 mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93] flex items-center gap-1.5';

/**
 * Unlocked banners (4 defaults + earned), then the ones still to earn: first from the user's
 * list / history, then famous trophy anime. Picking applies immediately and keeps the picker open.
 */
export function BannerPicker({ current, onPicked }: { current: string | null; onPicked: (id: string, url: string) => void }) {
  const { user } = useAuth();
  const watchlist = useAppStore((s) => s.watchlist);
  const history = useAppStore((s) => s.history);
  const progress = useAppStore((s) => s.progress);
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string | null>(null);

  const { data: unlocked = [] } = useQuery({
    queryKey: ['unlocked-banners', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      const { data, error: e } = await supabase!.from('unlocked_banners').select('*').order('unlocked_at', { ascending: false });
      if (e) throw e;
      return data ?? [];
    },
  });
  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.anime_id)), [unlocked]);

  // Started or planned anime from the list + everything in the history.
  const candidateIds = useMemo(() => {
    const ids = new Set<number>();
    for (const a of watchlist) if (a.listStatus !== 'completed' && a.listStatus !== 'dropped') ids.add(a.id);
    for (const h of history) ids.add(h.id);
    return [...ids].filter((id) => !unlockedIds.has(id)).slice(0, 50);
  }, [watchlist, history, unlockedIds]);

  const { data: lockedMedia = [] } = useQuery({
    queryKey: ['locked-banners', candidateIds.join(',')],
    enabled: candidateIds.length > 0,
    queryFn: async () => {
      const res = await fetchAniList(BANNERS_QUERY, { ids: candidateIds });
      return ((res?.Page?.media ?? []) as Media[]).filter((m) => m.bannerImage);
    },
  });

  const { data: showcase = [] } = useQuery({
    queryKey: ['trophy-showcase'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const res = await fetchAniList(TROPHY_SHOWCASE_QUERY, {});
      return ((res?.Page?.media ?? []) as Media[]).filter((m) => m.bannerImage && isTrophy(m.id, m.popularity));
    },
  });
  const trophies = showcase.filter((m) => !unlockedIds.has(m.id) && !candidateIds.includes(m.id)).slice(0, 12);

  const unlockedTiles: Tile[] = [
    ...DEFAULT_BANNERS.map((b) => ({ id: b.id, url: b.url, label: b.label })),
    ...unlocked.map((u) => ({ id: `anime:${u.anime_id}`, url: u.banner_url, label: u.title ?? '', trophy: u.is_trophy })),
  ];

  const pick = async (t: Tile) => {
    if (!supabase || t.id === selected) return;
    setError(null);
    const previous = selected;
    setSelected(t.id);
    const { error: e } = await supabase.rpc('set_banner', { banner: t.id });
    if (e) {
      haptic('warning');
      setSelected(previous);
      setError('Cette bannière n’est pas débloquée.');
      return;
    }
    haptic('success');
    toast('Bannière appliquée');
    onPicked(t.id, t.url);
  };

  const watchedCount = (id: number) => Object.entries(progress).filter(([k, p]) => k.startsWith(`${id}:`) && isWatched(p)).length;

  return (
    <div className="animate-in fade-in-0 slide-in-from-right-4 duration-300">
      <h3 className={sectionTitle}>Débloquées · {unlockedTiles.length}</h3>
      <div className={tileGrid}>
        {unlockedTiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t)}
            aria-pressed={selected === t.id}
            className={`relative aspect-[3/1] md:aspect-[2.4/1] rounded-xl overflow-hidden cursor-pointer transition-transform active:scale-[0.97] ${
              selected === t.id ? 'ring-2 ring-[#FFD60A] ring-offset-2 ring-offset-[#141416]' : 'hover:brightness-110'
            }`}
          >
            <img src={t.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute left-2.5 right-9 bottom-2 text-[13px] font-bold text-white line-clamp-1 text-left flex items-center gap-1">
              {t.trophy && <Crown className="w-3.5 h-3.5 text-[#FFD60A] shrink-0" aria-label="Trophée" />}
              {t.label}
            </span>
            {selected === t.id && (
              <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#FFD60A] text-black flex items-center justify-center animate-in zoom-in-50 duration-200">
                <Check className="w-4 h-4" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-[#FF6961]">{error}</p>}

      {lockedMedia.length > 0 && (
        <>
          <h3 className={`${sectionTitle} mt-6`}>Dans votre liste</h3>
          <div className={tileGrid}>
            {lockedMedia.map((m) => (
              <LockedTile key={m.id} media={m} seen={watchedCount(m.id)} />
            ))}
          </div>
        </>
      )}

      {trophies.length > 0 && (
        <>
          <h3 className={`${sectionTitle} mt-6`}>
            <Crown className="w-3.5 h-3.5 text-[#FFD60A]" /> Trophées à décrocher
          </h3>
          <div className={tileGrid}>
            {trophies.map((m) => (
              <LockedTile key={m.id} media={m} seen={watchedCount(m.id)} trophy />
            ))}
          </div>
        </>
      )}

      <p className="mt-5 text-[12px] text-[#8E8E93] px-1 flex gap-1.5">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>Terminez un anime sur SAKURA pour débloquer sa bannière. Les animes les plus populaires donnent aussi un trophée.</span>
      </p>
    </div>
  );
}

function LockedTile({ media: m, seen, trophy = false }: { media: Media; seen: number; trophy?: boolean }) {
  return (
    <Link
      href={`/anime?id=${m.id}`}
      className="group relative aspect-[3/1] md:aspect-[2.4/1] rounded-xl overflow-hidden"
      aria-label={`${mediaTitle(m)} : verrouillée. Ouvrir la fiche`}
    >
      <img src={m.bannerImage!} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover grayscale brightness-[.35] transition duration-300 group-hover:brightness-50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        {trophy ? <Crown className="w-4 h-4 text-[#FFD60A]/90" /> : <Lock className="w-4 h-4 text-white/80" />}
        <span className="mt-1 text-[12px] font-semibold text-white line-clamp-1">{mediaTitle(m)}</span>
        <span className="text-[11px] text-white/70">
          {seen}
          {m.episodes ? ` / ${m.episodes}` : ''} ép. vus
        </span>
      </div>
    </Link>
  );
}
