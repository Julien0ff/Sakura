'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ArrowLeft, SkipForward, X } from '@/components/ui/icons';
import type { SkipInterval } from '@/core/api/aniskip';
import { RatingPicker } from '@/components/anime/rating-picker';
import { haptic } from '@/lib/haptics';

const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), { ssr: false });

export interface PlayerSource {
  url: string;
  type: 'hls' | 'mp4' | 'youtube' | 'iframe';
  quality?: string;
}

interface PlayerOverlayProps {
  animeTitle: string;
  episodeLabel: string;
  color: string;
  poster?: string;
  isLoading: boolean;
  error: string | null;
  errorAction?: { label: string; onClick: () => void };
  sources: PlayerSource[];
  current: PlayerSource | null;
  onSelectSource: (s: PlayerSource) => void;
  onClose: () => void;
  next?: { label: string; onPlay: () => void } | null;
  autoNext: boolean;
  skipTimes: SkipInterval[];
  autoSkip: boolean;
  startAt: number;
  onProgress: (time: number, duration: number) => void;
  /** The user's rating for this episode (1–10). */
  episodeRating?: number | null;
  onRateEpisode?: (rating: number | null) => void;
}

const NEXT_COUNTDOWN = 8;
/** The end-of-episode rating card hides itself after this long. */
const RATE_PROMPT_MS = 12000;
const IDLE_MS = 3000;

function sourceName(s: PlayerSource, i: number) {
  if (s.url.includes('sibnet')) return 'Sibnet';
  if (s.url.includes('uqload')) return 'Uqload';
  if (s.url.includes('getvid') || s.url.includes('vip')) return 'VIP';
  return s.quality && s.quality !== 'Auto' ? s.quality : `Lecteur ${i + 1}`;
}

const subscribeNoop = () => () => {};

/** Full-screen player rendered in a portal on <body>, above every app layer (sidebar, tab bar). */
export function PlayerOverlay(props: PlayerOverlayProps) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<PlayerOverlayInner {...props} />, document.body);
}

function PlayerOverlayInner({
  animeTitle,
  episodeLabel,
  color,
  poster,
  isLoading,
  error,
  errorAction,
  sources,
  current,
  onSelectSource,
  onClose,
  next,
  autoNext,
  skipTimes,
  autoSkip,
  startAt,
  onProgress,
  episodeRating = null,
  onRateEpisode,
}: PlayerOverlayProps) {
  // End-of-episode rating prompt: shown once per episode, never touches the next-episode countdown.
  const [ratePrompt, setRatePrompt] = useState<'hidden' | 'shown' | 'done'>('hidden');
  const [promptFor, setPromptFor] = useState(episodeLabel);
  if (promptFor !== episodeLabel) {
    setPromptFor(episodeLabel);
    setRatePrompt('hidden');
  }
  const showRatePrompt = () => {
    if (onRateEpisode) setRatePrompt((r) => (r === 'hidden' ? 'shown' : r));
  };
  useEffect(() => {
    if (ratePrompt !== 'shown') return;
    const t = setTimeout(() => setRatePrompt('done'), RATE_PROMPT_MS);
    return () => clearTimeout(t);
  }, [ratePrompt]);
  const [idle, setIdle] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Chrome (top bar, sources) fades out with the mouse idle, like Plyr's own controls.
  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  };

  useEffect(() => {
    // Arm the idle timer once; the handler itself only touches state from an event/timer.
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // "Next episode" countdown after the video ends.
  useEffect(() => {
    if (countdown === null) return;
    const t = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        next?.onPlay();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown, next]);

  // Only hide while the video plays, so paused/idle states keep the title and controls visible.
  const chromeHidden = idle && playing && !isLoading && !error && countdown === null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${animeTitle} — ${episodeLabel}`}
      className={`fixed inset-0 z-[100] bg-black animate-in fade-in duration-300 ${chromeHidden ? 'cursor-none' : ''}`}
      onMouseMove={wake}
      onTouchStart={wake}
      onKeyDown={wake}
    >
      {/* Video / states */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
            <p className="font-semibold text-lg">Recherche de la vidéo…</p>
          </div>
        ) : error ? (
          <div className="mx-6 max-w-md flex flex-col items-center gap-4 text-center text-white bg-white/10 p-8 rounded-3xl backdrop-blur-md">
            <p className="font-bold text-xl">Vidéo indisponible</p>
            <p className="text-white/80">{error}</p>
            {errorAction && (
              <button onClick={errorAction.onClick} className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold cursor-pointer">
                {errorAction.label}
              </button>
            )}
          </div>
        ) : current ? (
          <VideoPlayer
            key={current.url}
            src={current.url}
            type={current.type}
            title={episodeLabel}
            poster={poster}
            startAt={startAt}
            skipTimes={skipTimes}
            autoSkip={autoSkip}
            onProgress={(time, duration) => {
              onProgress(time, duration);
              if (duration > 0 && time / duration >= 0.9) showRatePrompt();
            }}
            onPlayingChange={(p) => {
              setPlaying(p);
              if (p) wake();
            }}
            onEnded={() => {
              showRatePrompt();
              if (next && autoNext) setCountdown(NEXT_COUNTDOWN);
            }}
          />
        ) : null}
      </div>

      {/* Top chrome with a scrim so it stays readable over bright frames */}
      <div
        className={`absolute inset-x-0 top-0 z-[110] pointer-events-none transition-opacity duration-500 ${chromeHidden ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent" />
        <div className="relative flex items-start gap-3 px-4 md:px-6 pt-[max(env(safe-area-inset-top),16px)]">
          <button
            onClick={onClose}
            aria-label="Fermer le lecteur"
            className="pointer-events-auto shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-white/70 text-xs font-semibold uppercase tracking-wider truncate">{animeTitle}</div>
            <div className="text-white text-base md:text-lg font-bold truncate drop-shadow">{episodeLabel}</div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 shrink-0">
            {sources.length > 1 && (
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-md" role="radiogroup" aria-label="Lecteur">
                {sources.map((s, i) => (
                  <button
                    key={s.url}
                    role="radio"
                    aria-checked={current?.url === s.url}
                    onClick={() => {
                      haptic('selection');
                      onSelectSource(s);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      current?.url === s.url ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {sourceName(s, i)}
                  </button>
                ))}
              </div>
            )}
            {next && (
              <button
                onClick={() => {
                  haptic('medium');
                  next.onPlay();
                }}
                className="flex items-center gap-2 h-11 px-4 rounded-full bg-white/15 backdrop-blur-md text-white font-semibold text-sm hover:bg-white/25 transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
                <span className="hidden sm:inline">Suivant</span>
              </button>
            )}
          </div>
        </div>

        {/* Sources on phones: second row */}
        {sources.length > 1 && (
          <div className="sm:hidden relative mt-3 px-4 flex gap-1 overflow-x-auto scrollbar-none pointer-events-auto">
            {sources.map((s, i) => (
              <button
                key={s.url}
                onClick={() => {
                  haptic('selection');
                  onSelectSource(s);
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${current?.url === s.url ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}
              >
                {sourceName(s, i)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* End-of-episode rating (bottom-left, independent from the up-next card) */}
      {ratePrompt === 'shown' && onRateEpisode && (
        <div className="absolute z-[120] left-4 md:left-10 bottom-24 w-[min(92vw,340px)] p-4 rounded-3xl bg-black/70 backdrop-blur-xl border border-white/10 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Noter cet épisode</div>
            <button onClick={() => setRatePrompt('done')} aria-label="Fermer" className="p-1 rounded-full hover:bg-white/10 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <RatingPicker
            value={episodeRating}
            size="sm"
            label="Note de cet épisode"
            onChange={(r) => {
              onRateEpisode(r);
              setRatePrompt('done');
            }}
          />
        </div>
      )}

      {/* Up-next card */}
      {countdown !== null && next && (
        <div className="absolute z-[120] right-4 md:right-10 bottom-24 w-[min(92vw,360px)] p-5 rounded-3xl bg-black/70 backdrop-blur-xl border border-white/10 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Épisode suivant dans {countdown} s</div>
              <div className="font-bold mt-1 line-clamp-2">{next.label}</div>
            </div>
            <button onClick={() => setCountdown(null)} aria-label="Annuler" className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 h-1 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full" style={{ backgroundColor: color, animation: `hero-progress ${NEXT_COUNTDOWN}s linear forwards` }} />
          </div>
          <button
            onClick={() => {
              haptic('medium');
              setCountdown(null);
              next.onPlay();
            }}
            className="mt-4 w-full h-11 rounded-full bg-white text-black font-bold text-sm cursor-pointer"
          >
            Lire maintenant
          </button>
        </div>
      )}
    </div>
  );
}
