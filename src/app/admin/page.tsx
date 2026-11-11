'use client';

/* eslint-disable @next/next/no-img-element -- AniList banners */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/account/avatar';
import { Crown, Lock, Search, Trash2, X } from '@/components/ui/icons';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/core/auth';
import { fetchAniList } from '@/core/api/anilist';
import { supabase } from '@/lib/supabase';
import { isTrophy } from '@/lib/trophies';
import { haptic } from '@/lib/haptics';
import { parseAnimeQuery, type AdminBanner, type AdminStats, type AdminUser } from '@/lib/admin';
import { cartoonSummary, isCartoon, isCartoonId, tmdbIdOf, type TmdbCartoon } from '@/lib/cartoons';
import { DiscordWebhooksSection } from '@/components/admin/discord-webhooks';

type Media = { id: number; bannerImage: string | null; popularity: number | null; title: { romaji: string; english: string | null } };

const MEDIA_FIELDS = 'id bannerImage popularity title { romaji english }';
const BY_ID = `query ($id: Int) { Page(perPage: 1) { media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } } }`;
const BY_TITLE = `query ($search: String) { Page(perPage: 12) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} } } }`;

const mediaTitle = (m: Media) => m.title.english || m.title.romaji;
const sectionTitle = 'px-1 mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93] flex items-center gap-1.5';
const card = 'rounded-2xl bg-white/[0.06] border border-white/[0.08]';
const input = 'w-full h-11 pl-10 pr-3 rounded-xl bg-black/40 border border-white/10 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-sakura/70';

type AdminRpc = 'is_admin' | 'admin_stats' | 'admin_list_users' | 'admin_user_banners' | 'admin_unlock_banner' | 'admin_revoke_banner';

async function rpc<T>(name: AdminRpc, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args as never);
  if (error) throw error;
  return data as T;
}

/** Debounced copy of a value (search fields). */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Admin panel: reserved to the accounts listed in `public.admins` (checked by every RPC on the
 * server, the page only hides itself). Find a user, then unlock / revoke banners and trophies.
 */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending } = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: !!user && !!supabase,
    queryFn: () => rpc<boolean>('is_admin'),
  });
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const checking = loading || (!!user && isPending);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-6 md:pl-32 md:pr-10 pt-page md:pt-10 pb-10">
        <h1 className="text-[34px] md:text-5xl font-bold text-sakura mb-6 md:mb-8 flex items-center gap-3 md:gap-4 pr-14 md:pr-0" style={{ fontFamily: 'var(--font-impact)' }}>
          <Crown className="w-7 h-7 md:w-8 md:h-8 text-[#FFD60A] shrink-0" />
          Administration
        </h1>

        {checking ? (
          <div className={`${card} h-40 max-w-5xl animate-pulse`} />
        ) : !isAdmin ? (
          <div className={`${card} max-w-xl p-6 flex gap-3 items-start`}>
            <Lock className="w-5 h-5 text-white/70 shrink-0 mt-0.5" />
            <p className="text-[15px] text-white/80">Cette page est réservée à l’administrateur de SAKURA.</p>
          </div>
        ) : (
          <div className="max-w-6xl space-y-7">
            <Stats />
            <DiscordWebhooksSection />
            <div className="grid gap-7 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <UserList selectedId={selected?.id ?? null} onSelect={setSelected} />
              {selected ? (
                <UserPanel user={selected} onClose={() => setSelected(null)} />
              ) : (
                <div className={`${card} hidden lg:flex items-center justify-center p-10 text-[15px] text-[#8E8E93]`}>Choisissez un utilisateur.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Stats() {
  const { data } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => rpc<AdminStats>('admin_stats') });
  const items: [string, number | undefined][] = [
    ['Utilisateurs', data?.users],
    ['Profils publics', data?.public_profiles],
    ['Bannières', data?.banners],
    ['Trophées', data?.trophies],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {items.map(([label, n]) => (
        <div key={label} className={`${card} px-4 py-3`}>
          <div className="text-[26px] font-bold text-white tabular-nums">{n ?? '–'}</div>
          <div className="text-[13px] text-[#8E8E93]">{label}</div>
        </div>
      ))}
    </div>
  );
}

function UserList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (u: AdminUser) => void }) {
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const { data: users = [], isFetching } = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => rpc<AdminUser[]>('admin_list_users', { q: query }),
    placeholderData: (prev) => prev,
  });

  // Keep the open panel in step with the refreshed row (counters, banner in use).
  useEffect(() => {
    const fresh = users.find((u) => u.id === selectedId);
    if (fresh) onSelect(fresh);
  }, [users, selectedId, onSelect]);

  return (
    <section>
      <h2 className={sectionTitle}>Utilisateurs</h2>
      <div className="relative mb-2.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pseudo, nom ou identifiant" aria-label="Rechercher un utilisateur" className={input} />
      </div>
      <ul className={`${card} overflow-hidden divide-y divide-white/[0.08] ${isFetching ? 'opacity-70' : ''}`}>
        {users.length === 0 && <li className="px-4 py-4 text-[14px] text-[#8E8E93]">{isFetching ? 'Recherche…' : 'Aucun utilisateur.'}</li>}
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => {
                haptic('selection');
                onSelect(u);
              }}
              aria-pressed={selectedId === u.id}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors ${selectedId === u.id ? 'bg-sakura/15' : 'hover:bg-white/[0.04]'}`}
            >
              <Avatar src={u.avatar_url} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-white truncate">{u.display_name || u.username || 'Sans nom'}</span>
                <span className="block text-[13px] text-[#8E8E93] truncate">{u.username ? `@${u.username}` : 'pas encore de pseudo'}</span>
              </span>
              <span className="text-[12px] text-[#8E8E93] tabular-nums text-right shrink-0">
                {u.banners} bann.
                {u.trophies > 0 && (
                  <span className="flex items-center justify-end gap-0.5 text-[#FFD60A]">
                    <Crown className="w-3 h-3" />
                    {u.trophies}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UserPanel({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLElement>(null);
  const { user: me } = useAuth();

  // Phones: the panel sits under the list, bring it into view.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [user.id]);

  const key = ['admin', 'banners', user.id];
  const { data: banners = [], isPending } = useQuery({ queryKey: key, queryFn: () => rpc<AdminBanner[]>('admin_user_banners', { target: user.id }) });
  const unlockedIds = new Set(banners.map((b) => b.anime_id));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    if (user.id === me?.id) void qc.invalidateQueries({ queryKey: ['unlocked-banners', me.id] });
  };

  const unlock = useMutation({
    mutationFn: (b: { anime: number; url: string; title: string; trophy: boolean }) =>
      rpc('admin_unlock_banner', { target: user.id, anime: b.anime, url: b.url, anime_title: b.title, trophy: b.trophy }),
    onSuccess: (_d, b) => {
      haptic('success');
      toast(b.trophy ? `🏆 ${b.title} : trophée débloqué` : `${b.title} : bannière débloquée`);
      refresh();
    },
    onError: () => {
      haptic('warning');
      toast('Action refusée par le serveur');
    },
  });
  const revoke = useMutation({
    mutationFn: (b: AdminBanner) => rpc('admin_revoke_banner', { target: user.id, anime: b.anime_id }),
    onSuccess: (_d, b) => {
      haptic('success');
      toast(`${b.title ?? 'Bannière'} : retirée`);
      refresh();
    },
    onError: () => toast('Action refusée par le serveur'),
  });

  const name = user.display_name || user.username || 'Sans nom';

  return (
    <section ref={ref} className="space-y-6 scroll-mt-[calc(var(--safe-top)+16px)] animate-in fade-in-0 slide-in-from-right-4 duration-300">
      <div className={`${card} p-4 flex items-center gap-3`}>
        <Avatar src={user.avatar_url} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-semibold text-white truncate">{name}</div>
          <div className="text-[13px] text-[#8E8E93] truncate">
            {user.username ? (
              <Link href={`/${user.username}`} className="hover:text-white underline-offset-2 hover:underline">
                @{user.username}
              </Link>
            ) : (
              'pas encore de pseudo'
            )}
            {' · '}
            {user.is_public ? 'profil public' : 'profil privé'}
            {' · inscrit le '}
            {new Date(user.created_at).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div>
        <h3 className={sectionTitle}>Bannières débloquées · {banners.length}</h3>
        {isPending ? (
          <div className={`${card} h-24 animate-pulse`} />
        ) : banners.length === 0 ? (
          <p className={`${card} px-4 py-4 text-[14px] text-[#8E8E93]`}>Aucune bannière d’anime pour l’instant (les 4 par défaut sont toujours disponibles).</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {banners.map((b) => (
              <UnlockedTile
                key={b.anime_id}
                banner={b}
                inUse={user.banner_id === `anime:${b.anime_id}`}
                busy={unlock.isPending || revoke.isPending}
                onTrophy={() => unlock.mutate({ anime: b.anime_id, url: b.banner_url, title: b.title ?? '', trophy: !b.is_trophy })}
                onRevoke={() => revoke.mutate(b)}
              />
            ))}
          </div>
        )}
      </div>

      <UnlockSearch unlockedIds={unlockedIds} busy={unlock.isPending} onUnlock={(m, trophy) => unlock.mutate({ anime: m.id, url: m.bannerImage!, title: mediaTitle(m), trophy })} />
    </section>
  );
}

function UnlockedTile({ banner: b, inUse, busy, onTrophy, onRevoke }: { banner: AdminBanner; inUse: boolean; busy: boolean; onTrophy: () => void; onRevoke: () => void }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div className="relative aspect-[3/1] rounded-xl overflow-hidden">
      <img src={b.banner_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {inUse && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[11px] font-semibold text-white">Affichée</span>}
      <span className="absolute left-2.5 right-24 bottom-2 text-[13px] font-bold text-white line-clamp-1 flex items-center gap-1">
        {b.is_trophy && <Crown className="w-3.5 h-3.5 text-[#FFD60A] shrink-0" aria-label="Trophée" />}
        {b.title}
      </span>
      <div className="absolute right-2 bottom-2 flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onTrophy}
          aria-pressed={b.is_trophy}
          aria-label={b.is_trophy ? 'Retirer le trophée' : 'Donner le trophée'}
          title={b.is_trophy ? 'Retirer le trophée' : 'Donner le trophée'}
          className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md disabled:opacity-50 ${b.is_trophy ? 'bg-[#FFD60A] text-black' : 'bg-black/55 text-white hover:bg-black/75'}`}
        >
          <Crown className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => (confirming ? (setConfirming(false), onRevoke()) : (haptic('warning'), setConfirming(true)))}
          aria-label={confirming ? 'Confirmer le retrait' : 'Retirer la bannière'}
          className={`h-9 rounded-full flex items-center justify-center gap-1 cursor-pointer backdrop-blur-md disabled:opacity-50 transition-all ${
            confirming ? 'px-3 bg-[#FF453A] text-white text-[12px] font-semibold' : 'w-9 bg-black/55 text-[#FF6961] hover:bg-black/75'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          {confirming && 'Retirer ?'}
        </button>
      </div>
    </div>
  );
}

function UnlockSearch({ unlockedIds, busy, onUnlock }: { unlockedIds: Set<number>; busy: boolean; onUnlock: (m: Media, trophy: boolean) => void }) {
  const [text, setText] = useState('');
  const parsed = parseAnimeQuery(useDebounced(text, 400));
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['admin', 'anime', parsed],
    enabled: !!parsed,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!parsed) return [];
      if ('id' in parsed) {
        if (isCartoonId(parsed.id)) {
          const res = await fetch(`/api/tmdb/tv/${tmdbIdOf(parsed.id)}?language=fr-FR`);
          if (!res.ok) return [];
          const c = cartoonSummary(await res.json());
          return [{ id: c.id, bannerImage: c.bannerImage, popularity: 0, title: { romaji: c.title.romaji || '', english: c.title.english || null } }] as Media[];
        }
        const res = await fetchAniList(BY_ID, { id: parsed.id });
        return (res?.Page?.media ?? []) as Media[];
      }
      const [aniRes, tmdbRes] = await Promise.all([
        fetchAniList(BY_TITLE, { search: parsed.search }).catch(() => null),
        fetch(`/api/tmdb/search/tv?query=${encodeURIComponent(parsed.search)}&language=fr-FR`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const aniMedia = ((aniRes?.Page?.media ?? []) as Media[]).filter((m) => m.bannerImage);
      const tmdbShows: TmdbCartoon[] = tmdbRes?.results ?? [];
      const cartoonMediaList: Media[] = tmdbShows
        .filter(isCartoon)
        .slice(0, 4)
        .map(cartoonSummary)
        .filter((c) => Boolean(c.bannerImage))
        .map((c) => ({
          id: c.id,
          bannerImage: c.bannerImage,
          popularity: 0,
          title: { romaji: c.title.romaji || '', english: c.title.english || null },
        }));
      return [...aniMedia, ...cartoonMediaList];
    },
  });

  return (
    <div>
      <h3 className={sectionTitle}>Débloquer une bannière</h3>
      <div className="relative mb-2.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Titre, identifiant ou lien (anime ou dessin animé)"
          aria-label="Rechercher un anime ou dessin animé"
          className={input}
        />
      </div>
      {parsed && !isFetching && results.length === 0 && <p className="px-1 text-[14px] text-[#8E8E93]">Aucun anime trouvé.</p>}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 ${isFetching ? 'opacity-70' : ''}`}>
        {results.map((m) => (
          <SearchTile key={m.id} media={m} unlocked={unlockedIds.has(m.id)} busy={busy} onUnlock={onUnlock} />
        ))}
      </div>
    </div>
  );
}

function SearchTile({ media: m, unlocked, busy, onUnlock }: { media: Media; unlocked: boolean; busy: boolean; onUnlock: (m: Media, trophy: boolean) => void }) {
  const suggested = isTrophy(m.id, m.popularity);
  const [trophy, setTrophy] = useState(suggested);

  return (
    <div className="relative aspect-[3/1] rounded-xl overflow-hidden bg-white/[0.06]">
      {m.bannerImage && <img src={m.bannerImage} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <span className="absolute left-2.5 right-2.5 top-2 text-[11px] text-white/70 tabular-nums">
        #{m.id}
        {suggested && ' · trophée suggéré'}
      </span>
      <span className="absolute left-2.5 right-28 bottom-2 text-[13px] font-bold text-white line-clamp-1">{mediaTitle(m)}</span>
      <div className="absolute right-2 bottom-2 flex gap-1.5">
        {!m.bannerImage ? (
          <span className="h-9 px-3 rounded-full bg-black/60 text-[12px] text-white/70 flex items-center">Pas de bannière</span>
        ) : unlocked ? (
          <span className="h-9 px-3 rounded-full bg-black/60 text-[12px] font-semibold text-white flex items-center">Déjà débloquée</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                haptic('selection');
                setTrophy((t) => !t);
              }}
              aria-pressed={trophy}
              aria-label={trophy ? 'Avec trophée' : 'Sans trophée'}
              title={trophy ? 'Avec trophée' : 'Sans trophée'}
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md ${trophy ? 'bg-[#FFD60A] text-black' : 'bg-black/55 text-white hover:bg-black/75'}`}
            >
              <Crown className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUnlock(m, trophy)}
              className="h-9 px-3.5 rounded-full bg-white text-black text-[13px] font-semibold cursor-pointer disabled:opacity-50 hover:bg-white/90"
            >
              Débloquer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
