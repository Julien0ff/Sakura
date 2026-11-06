'use client';

/* eslint-disable @next/next/no-img-element -- AniList banners / local SVGs */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Lock } from '@/components/ui/icons';
import { useAppStore, isWatched } from '@/core/store';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BANNERS } from '@/lib/banners';
import { fetchAniList } from '@/core/api/anilist';
import { haptic } from '@/lib/haptics';

const BANNERS_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) { id bannerImage episodes title { romaji english } }
  }
}`;

type Tile = { id: string; url: string; label: string; trophy?: boolean };

/** Unlocked banners first (4 defaults + earned), then the ones still to earn from the user's list. */
export function BannerPicker({ current, onPicked }: { current: string | null; onPicked: () => void }) {
  const { user } = useAuth();
  const watchlist = useAppStore((s) => s.watchlist);
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

  const candidates = useMemo(
    () => watchlist.filter((a) => a.listStatus !== 'completed' && a.listStatus !== 'dropped' && !unlocked.some((u) => u.anime_id === a.id)).slice(0, 50),
    [watchlist, unlocked]
  );
  const { data: lockedMedia = [] } = useQuery({
    queryKey: ['locked-banners', candidates.map((c) => c.id).join(',')],
    enabled: candidates.length > 0,
    queryFn: async () => {
      const res = await fetchAniList(BANNERS_QUERY, { ids: candidates.map((c) => c.id) });
      return ((res?.Page?.media ?? []) as { id: number; bannerImage: string | null; episodes: number | null; title: { romaji: string; english: string | null } }[]).filter((m) => m.bannerImage);
    },
  });

  const unlockedTiles: Tile[] = [
    ...DEFAULT_BANNERS.map((b) => ({ id: b.id, url: b.url, label: b.label })),
    ...unlocked.map((u) => ({ id: `anime:${u.anime_id}`, url: u.banner_url, label: u.title ?? '', trophy: u.is_trophy })),
  ];

  const pick = async (id: string) => {
    if (!supabase) return;
    setError(null);
    setSelected(id);
    const { error: e } = await supabase.rpc('set_banner', { banner: id });
    if (e) {
      haptic('warning');
      setSelected(current);
      setError('Cette bannière n’est pas débloquée.');
      return;
    }
    haptic('success');
    onPicked();
  };

  const watchedCount = (id: number) => Object.entries(progress).filter(([k, p]) => k.startsWith(`${id}:`) && isWatched(p)).length;

  return (
    <div>
      <h3 className="px-1 mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">Débloquées · {unlockedTiles.length}</h3>
      <div className="grid grid-cols-2 gap-2">
        {unlockedTiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-pressed={selected === t.id}
            className={`relative h-20 rounded-xl overflow-hidden cursor-pointer ${selected === t.id ? 'ring-2 ring-[#FFD60A] ring-offset-2 ring-offset-[#111]' : ''}`}
          >
            <img src={t.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute left-2 bottom-1.5 text-[12px] font-bold text-white line-clamp-1 text-left">
              {t.label} {t.trophy ? '🏆' : ''}
            </span>
            {selected === t.id && (
              <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#FFD60A] text-black flex items-center justify-center">
                <Check className="w-4 h-4" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-[#FF6961]">{error}</p>}

      {lockedMedia.length > 0 && (
        <>
          <h3 className="px-1 mt-5 mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">À débloquer</h3>
          <div className="grid grid-cols-2 gap-2">
            {lockedMedia.map((m) => {
              const seen = watchedCount(m.id);
              return (
                <div key={m.id} className="relative h-20 rounded-xl overflow-hidden" aria-label={`${m.title.english || m.title.romaji} : verrouillée`}>
                  <img src={m.bannerImage!} alt="" className="absolute inset-0 w-full h-full object-cover grayscale brightness-[.35]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                    <Lock className="w-4 h-4 text-white/80" />
                    <span className="mt-1 text-[11px] font-semibold text-white line-clamp-1">{m.title.english || m.title.romaji}</span>
                    <span className="text-[10px] text-white/70">
                      {seen}
                      {m.episodes ? ` / ${m.episodes}` : ''} ép. vus
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="mt-4 text-[12px] text-[#8E8E93] px-1">
        🔒 Terminez un anime sur SAKURA pour débloquer sa bannière. Les animes les plus populaires donnent aussi un trophée 🏆.
      </p>
    </div>
  );
}
