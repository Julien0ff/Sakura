'use client';

/* eslint-disable @next/next/no-img-element -- remote covers (AniList / TMDB) */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { progressKey, useAppStore, useHydrated } from '@/core/store';
import { haptic } from '@/lib/haptics';
import { Play, X } from '@/components/ui/icons';

/** Once per launch (tab / app session). */
const SESSION_KEY = 'sakura.resumeOffered';
/** After the splash screen (3 s + 1.5 s exit, see splash-screen.tsx). */
const DELAY_MS = 4700;
/** Synced history can land a few seconds after launch: keep looking for this long. */
const WATCH_MS = 12_000;
/** Older than that, it's no longer « where you left off ». */
const MAX_AGE_MS = 14 * 86_400_000;

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/**
 * « Reprendre là où vous en étiez ? »: at launch, the last episode left unfinished, whichever device
 * it was watched on (history and progress are synced). Like Netflix, one tap resumes it.
 */
export function ResumePrompt() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const last = useAppStore((s) => s.history[0]);
  const progress = useAppStore((s) => (last ? s.progress[progressKey(last.id, last.season, last.episodeNumber)] : undefined));
  const [phase, setPhase] = useState<'waiting' | 'open' | 'closing' | 'done'>('waiting');
  const [ready, setReady] = useState(false);
  const [launchedAt] = useState(() => Date.now());
  /** Phones: shrinks to poster + play + progress once the page scrolls (tap the poster to expand). */
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let offered = false;
    try {
      offered = Boolean(sessionStorage.getItem(SESSION_KEY));
    } catch {
      /* private mode */
    }
    if (offered) return;
    const show = setTimeout(() => setReady(true), DELAY_MS);
    const stop = setTimeout(() => setPhase((p) => (p === 'waiting' ? 'done' : p)), DELAY_MS + WATCH_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(stop);
    };
  }, []);

  const ratio = progress && progress.duration > 0 ? progress.time / progress.duration : 0;
  const resumable =
    hydrated &&
    !!last &&
    !!progress &&
    ratio >= 0.03 &&
    ratio < 0.9 &&
    launchedAt - Math.max(progress.updatedAt, last.watchedAt) < MAX_AGE_MS;
  // Already on an anime page (or in the player): the page offers it itself.
  const onAnimePage = pathname === '/anime';

  useEffect(() => {
    if (phase !== 'waiting' || !ready || !resumable || onAnimePage) return;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* private mode */
    }
    const t = setTimeout(() => setPhase('open'), 0);
    return () => clearTimeout(t);
  }, [phase, ready, resumable, onAnimePage]);

  // Leaving for the anime page (Reprendre or not) closes it.
  useEffect(() => {
    if (onAnimePage && phase === 'open') {
      const t = setTimeout(() => setPhase('done'), 0);
      return () => clearTimeout(t);
    }
  }, [onAnimePage, phase]);

  useEffect(() => {
    if (phase !== 'open') return;
    const phone = window.matchMedia('(max-width: 767px)');
    // `scroll` doesn't bubble: listen in the capture phase to hear the page's own scroller (#main-scroll).
    const onScroll = (e: Event) => {
      if (!phone.matches) return;
      const el = e.target instanceof HTMLElement ? e.target : document.scrollingElement;
      if (!el || (el.id !== 'main-scroll' && el !== document.scrollingElement)) return;
      setCompact(el.scrollTop > 24);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [phase]);

  if ((phase !== 'open' && phase !== 'closing') || !last || !progress) return null;

  const close = () => {
    haptic('light');
    setPhase('closing');
    setTimeout(() => setPhase('done'), 300);
  };
  const episode = `${last.season > 1 ? `S${last.season} · ` : ''}Épisode ${last.episodeNumber}`;

  // Only opacity and transform move (compositor-only, smooth on phones): the card and the bubble sit
  // on the same bottom-right anchor and cross-fade, nothing is re-laid out.
  const swap = 'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform';
  const percent = Math.round(ratio * 100);
  const href = `/anime?id=${last.id}&play=1`;
  const RING = 2 * Math.PI * 30;

  return (
    <div
      role="dialog"
      aria-label="Reprendre la lecture"
      className={`pointer-events-none fixed z-[60] right-3 md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] md:bottom-6 w-[calc(100vw-24px)] md:w-[380px] transition-[opacity,transform] duration-300 ${
        phase === 'closing' ? 'opacity-0 translate-y-3' : 'animate-in fade-in slide-in-from-bottom-6 duration-500'
      }`}
    >
      {/* Full card */}
      <div
        aria-hidden={compact}
        className={`origin-bottom-right ${swap} ${compact ? 'opacity-0 scale-[0.35] translate-y-2' : 'pointer-events-auto opacity-100 scale-100'}`}
      >
        <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#1C1C1E]/90 backdrop-blur-2xl shadow-2xl shadow-black/60">
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{ background: `radial-gradient(120% 90% at 0% 0%, ${last.color || '#FF7AA8'} 0%, transparent 60%)` }}
          />
          <div className="relative flex items-center gap-3 p-3">
            {last.cover && <img src={last.cover} alt="" className="w-12 aspect-[2/3] rounded-lg object-cover shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Reprendre là où vous en étiez</div>
              <div className="text-[15px] font-semibold text-white truncate">{last.title}</div>
              <div className="text-[12px] text-white/70 tabular-nums">
                {episode} · {last.lang.toUpperCase()} · {clock(progress.time)} / {clock(progress.duration)}
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              tabIndex={compact ? -1 : 0}
              aria-label="Fermer"
              className="self-start p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative px-3 pb-3 flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-sakura" style={{ width: `${percent}%` }} />
            </div>
            <Link
              href={href}
              tabIndex={compact ? -1 : 0}
              onClick={() => haptic('selection')}
              className="shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-95 transition-transform"
            >
              <Play className="w-4 h-4" />
              Reprendre
            </Link>
          </div>
        </div>
      </div>

      {/* Bubble (phones, once the page scrolls): the poster in a circle, play in the middle,
          the progress as a pink ring around it. */}
      <Link
        href={href}
        onClick={() => haptic('selection')}
        aria-hidden={!compact}
        tabIndex={compact ? 0 : -1}
        aria-label={`Reprendre ${last.title}, ${episode} (${percent} %)`}
        className={`absolute bottom-0 right-0 w-16 h-16 rounded-full origin-bottom-right ${swap} ${
          compact ? 'pointer-events-auto opacity-100 scale-100' : 'opacity-0 scale-50'
        } active:scale-90`}
        style={{ filter: `drop-shadow(0 8px 22px ${last.color ? `${last.color}99` : 'rgba(255,122,168,0.55)'})` }}
      >
        <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r="30" fill="#1C1C1E" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <circle
            cx="32"
            cy="32"
            r="30"
            fill="none"
            stroke="#FF7AA8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - ratio)}
          />
        </svg>
        {last.cover && <img src={last.cover} alt="" className="absolute inset-[5px] w-[calc(100%-10px)] h-[calc(100%-10px)] rounded-full object-cover" />}
        <span className="absolute inset-[5px] rounded-full bg-black/35 flex items-center justify-center">
          <Play className="w-6 h-6 text-white translate-x-[1px] drop-shadow" />
        </span>
      </Link>
    </div>
  );
}
