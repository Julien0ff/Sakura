'use client';

/* eslint-disable @next/next/no-img-element -- banners come from AniList / local SVGs */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Lock, Pencil, Share2 } from '@/components/ui/icons';
import { Avatar } from '@/components/account/avatar';
import { ProfileBlockView } from '@/components/profile/blocks';
import { EditSheet } from '@/components/profile/edit-sheet';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BANNERS } from '@/lib/banners';
import type { ProfileStats, PublicProfile } from '@/lib/public-profile';
import { haptic } from '@/lib/haptics';

function bannerUrl(p: PublicProfile) {
  return p.banner.url ?? DEFAULT_BANNERS.find((b) => b.id === p.banner.id)?.url ?? DEFAULT_BANNERS[0].url;
}

function Stats({ stats }: { stats: ProfileStats }) {
  const cells: [string, string][] = [
    [String(stats.completed), 'Terminés'],
    [String(stats.watching), 'En cours'],
    [`${stats.hours} h`, 'Visionnées'],
    [stats.avg_rating != null ? String(stats.avg_rating).replace('.', ',') : '–', 'Note moy.'],
  ];
  return (
    <div className="grid grid-cols-4 gap-2 md:gap-3 px-5 md:px-0">
      {cells.map(([v, l]) => (
        <div key={l} className="rounded-2xl bg-white/[0.06] border border-white/[0.06] py-3 md:py-5 text-center">
          <div className="text-[18px] md:text-[26px] font-bold text-white tabular-nums">{v}</div>
          <div className="text-[11px] md:text-[12px] text-[#8E8E93]">{l}</div>
        </div>
      ))}
    </div>
  );
}

export function ProfileView({ username, initial }: { username: string; initial: PublicProfile | null }) {
  const { user, profile: me, loading } = useAuth();
  const isMe = !!me?.username && me.username === username;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // The owner re-reads through their session: private profile + hidden blocks.
  const { data: ownData, isLoading: ownLoading } = useQuery({
    queryKey: ['own-profile', username, user?.id],
    enabled: isMe && !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_public_profile', { name: username });
      if (error) throw error;
      return data as unknown as PublicProfile | null;
    },
  });
  const data = (isMe ? ownData : null) ?? initial;

  if (!data) {
    if (loading || (isMe && ownLoading)) return <div className="min-h-[60vh]" />;
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="w-8 h-8 text-[#8E8E93]" />
        <p className="text-white text-lg font-semibold">Ce profil est privé ou n’existe pas.</p>
        <Link href="/" className="mt-2 px-5 h-11 inline-flex items-center rounded-full bg-white/10 text-white font-semibold">
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  const owner = isMe && data.is_owner;
  const memberSince = new Date(data.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const share = async () => {
    haptic('selection');
    const url = `${window.location.origin}/${data.username}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Profil SAKURA de @${data.username}`, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(url);
    toast('Lien du profil copié');
  };

  return (
    <div className="animate-in fade-in duration-500 pb-32 md:pl-[104px] md:pr-6 md:pt-4">
      <div className="mx-auto max-w-[1400px]">
      {/* Banner */}
      <div className="relative h-[200px] md:h-[280px] xl:h-[340px] md:rounded-[28px] overflow-hidden bg-white/5">
        <img src={bannerUrl(data)} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
      </div>

      <div className="md:px-8">
        {/* Header: avatar left, name beside (validated layout) */}
        <div className="relative -mt-12 md:-mt-16 px-5 md:px-0 flex items-end gap-4 md:gap-6">
          <Avatar src={data.avatar_url} alt={data.display_name ?? data.username} size={96} className="border-4 border-black md:hidden" />
          <Avatar src={data.avatar_url} alt={data.display_name ?? data.username} size={128} className="border-4 border-black hidden md:block" />
          <div className="min-w-0 pb-1 flex-1">
            <h1 className="text-[24px] md:text-[34px] font-bold text-white leading-tight truncate">{data.display_name || `@${data.username}`}</h1>
            <p className="text-[14px] text-[#8E8E93] truncate">
              @{data.username} · membre depuis {memberSince}
            </p>
          </div>
          <div className="flex gap-2 pb-1 shrink-0">
            <button type="button" onClick={share} aria-label="Partager le profil" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer">
              <Share2 className="w-4 h-4" />
            </button>
            {owner && (
              <button
                type="button"
                onClick={() => {
                  haptic('selection');
                  setEditing(true);
                }}
                className="h-10 px-4 rounded-full bg-white text-black text-[14px] font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">Modifier le profil</span>
              </button>
            )}
          </div>
        </div>

        {owner && !data.is_public && (
          <p className="mx-5 md:mx-0 mt-4 text-[13px] text-[#8E8E93] bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" /> Profil privé : vous seul le voyez. Rendez-le public dans « Modifier le profil ».
          </p>
        )}

        {data.trophies.length > 0 && (
          <div className="mt-4 px-5 md:px-0 flex gap-2 overflow-x-auto scrollbar-none">
            {data.trophies.map((t) => (
              <Link key={t.anime_id} href={`/anime?id=${t.anime_id}`} className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#FFD60A]/15 border border-[#FFD60A]/30 rounded-full px-3 py-1 hover:bg-[#FFD60A]/25 transition-colors">
                <Crown className="w-3.5 h-3.5 text-[#FFD60A]" aria-label="Trophée" /> {t.title}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 md:mt-8 space-y-8 md:space-y-10">
          {data.blocks.map((b) =>
            b.id === 'stats' ? (
              <div key="stats" className={owner && !b.visible ? 'opacity-50' : ''}>
                <Stats stats={b.stats} />
              </div>
            ) : (
              <ProfileBlockView key={b.id} block={b} hidden={owner && !b.visible} />
            )
          )}
          {data.blocks.length === 0 && <p className="px-5 md:px-0 text-[#8E8E93]">Ce profil n’affiche rien pour le moment.</p>}
        </div>
      </div>

      </div>

      {owner && editing && (
        <EditSheet
          profile={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['own-profile', username] });
          }}
        />
      )}
    </div>
  );
}
