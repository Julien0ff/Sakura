'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from '@/components/ui/icons';

/** Image served from /public (the file name contains a space, hence the encoding). */
export const HUNTER_EGG_SRC = encodeURI('/easter-egg Hunter.jpg');

/** All Hunter×Hunter entries (1999, 2011, OVAs, movie) share this in their romaji title. */
export function isHunterXHunter(title?: { romaji?: string | null; english?: string | null }) {
  const t = `${title?.romaji ?? ''} ${title?.english ?? ''}`.toUpperCase();
  return /HUNTER\s*[×X]\s*HUNTER/.test(t);
}

const CLICKS = 5;
const WINDOW_MS = 1500;

/**
 * Fires `onTrigger` after CLICKS clicks within WINDOW_MS. Returns a click handler.
 * Clicks on links/buttons inside the target are ignored so normal actions still work.
 */
export function useRapidClicks(onTrigger: () => void, enabled: boolean) {
  const hits = useRef<number[]>([]);
  return useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      if ((e.target as HTMLElement).closest('a, button')) return;
      const now = performance.now();
      hits.current = [...hits.current.filter((t) => now - t < WINDOW_MS), now];
      if (hits.current.length >= CLICKS) {
        hits.current = [];
        onTrigger();
      }
    },
    [enabled, onTrigger]
  );
}

/** Large popup showing the easter-egg image, with a close button (Esc / backdrop also close). */
export function EasterEggDialog({ open, onClose, src }: { open: boolean; onClose: () => void; src: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Easter egg"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="egg-dialog m-auto p-0 bg-transparent overflow-visible max-w-[min(92vw,720px)] max-h-[88dvh]"
    >
      <div className="relative">
        <img
          src={src}
          alt="Easter egg Hunter×Hunter"
          onLoad={() => setLoaded(true)}
          className={`block max-w-[min(92vw,720px)] max-h-[88dvh] w-auto h-auto rounded-[28px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <button
          onClick={onClose}
          autoFocus
          aria-label="Fermer"
          className="absolute -top-3 -right-3 md:top-4 md:right-4 w-11 h-11 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-md text-white ring-1 ring-white/20 hover:bg-black/90 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 -bottom-10 whitespace-nowrap text-[13px] text-white/70">
          Clique 5 fois sur l&apos;affiche pour revenir à l&apos;original
        </p>
      </div>
    </dialog>
  );
}
