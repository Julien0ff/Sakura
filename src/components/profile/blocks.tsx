/* eslint-disable @next/next/no-img-element -- AniList covers, images are unoptimized anyway */
import Link from 'next/link';
import { BLOCK_LABELS } from '@/core/tracking';
import type { ProfileBlock, ProfileItem } from '@/lib/public-profile';

const EMPTY: Record<string, string> = {
  favorite: 'Aucun anime favori pour l’instant.',
  watching: 'Rien en cours.',
  completed: 'Aucun anime terminé.',
  top_rated: 'Aucune note pour l’instant.',
  episode_ratings: 'Aucun épisode noté.',
  planned: 'Rien à voir pour l’instant.',
};

function Cover({ item, caption }: { item: ProfileItem; caption?: string }) {
  return (
    <Link href={`/anime?id=${item.anime_id}`} className="shrink-0 w-[104px] md:w-[124px] group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/[0.06]">
        {item.cover && <img src={item.cover} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
        {caption && (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-bold text-white">{caption}</span>
        )}
        {item.completed_on_sakura && (
          <span title="Terminé sur SAKURA" className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-[12px]">
            🌸
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[13px] font-medium text-[#F2F2F7] line-clamp-1">{item.title}</div>
    </Link>
  );
}

function caption(blockId: string, item: ProfileItem) {
  if (blockId === 'episode_ratings') return `${item.season && item.season > 1 ? `S${item.season} ` : ''}Ép. ${item.episode} · ★ ${item.rating}`;
  if (blockId === 'watching' && item.episode) return `${item.season && item.season > 1 ? `S${item.season} · ` : ''}Ép. ${item.episode}`;
  if (item.rating) return `★ ${item.rating}`;
  return undefined;
}

/** One profile section. `hidden` dims blocks the owner has hidden from visitors. */
export function ProfileBlockView({ block, hidden = false }: { block: Exclude<ProfileBlock, { id: 'stats' }>; hidden?: boolean }) {
  return (
    <section className={hidden ? 'opacity-50' : ''}>
      <h2 className="px-5 md:px-0 mb-3 text-[17px] font-bold text-white flex items-center gap-2">
        {BLOCK_LABELS[block.id]}
        {hidden && <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93] bg-white/10 rounded px-1.5 py-0.5">Masqué</span>}
      </h2>
      {block.items.length === 0 ? (
        <p className="px-5 md:px-0 text-[14px] text-[#8E8E93]">{EMPTY[block.id]}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-none px-5 md:px-0 pb-1">
          {block.items.map((item, i) => (
            <Cover key={`${item.anime_id}-${item.season ?? ''}-${item.episode ?? ''}-${i}`} item={item} caption={caption(block.id, item)} />
          ))}
        </div>
      )}
    </section>
  );
}
