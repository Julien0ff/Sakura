'use client';

import { Bookmark, BookmarkCheck, Check, Heart, Trash2 } from '@/components/ui/icons';
import { useAppStore, type AnimeRef } from '@/core/store';
import { LIST_STATUSES, STATUS_LABELS } from '@/core/tracking';
import { Popover } from '@/components/ui/popover';
import { haptic } from '@/lib/haptics';

/** Replaces the old "Ma liste" toggle: pick a status, mark favorite, or remove. */
export function StatusPicker({ anime, className = '', wrapperClassName = '' }: { anime: AnimeRef; className?: string; wrapperClassName?: string }) {
  const entry = useAppStore((s) => s.watchlist.find((a) => a.id === anime.id));
  const setListStatus = useAppStore((s) => s.setListStatus);
  const setFavorite = useAppStore((s) => s.setFavorite);

  return (
    <Popover
      label="Statut dans ma liste"
      className={wrapperClassName}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={() => {
            haptic('selection');
            toggle();
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={className}
        >
          {entry ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          {entry ? STATUS_LABELS[entry.listStatus] : 'Ma liste'}
          {entry?.favorite && <Heart className="w-3.5 h-3.5 text-[#FF375F]" fill="currentColor" aria-label="Favori" />}
        </button>
      )}
    >
      {(close) => (
        <div className="w-56 flex flex-col">
          {LIST_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                haptic(entry ? 'selection' : 'success');
                setListStatus(anime, st);
                close();
              }}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[15px] text-white hover:bg-white/10 cursor-pointer text-left"
            >
              {STATUS_LABELS[st]}
              {entry?.listStatus === st && <Check className="w-4 h-4" strokeWidth={3} />}
            </button>
          ))}
          {entry && (
            <>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setFavorite(anime.id, !entry.favorite);
                  close();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-white hover:bg-white/10 cursor-pointer text-left"
              >
                <Heart className="w-4 h-4" fill={entry.favorite ? 'currentColor' : 'none'} />
                {entry.favorite ? 'Retirer des favoris' : 'Anime favori'}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setListStatus(anime, null);
                  close();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-[#FF6961] hover:bg-white/10 cursor-pointer text-left"
              >
                <Trash2 className="w-4 h-4" /> Retirer de ma liste
              </button>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}
