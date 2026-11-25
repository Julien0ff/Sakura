'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ArrowLeft, Check, ChevronDown, FastForward, Maximize, Minimize, MonitorPlay, SkipForward, Star, X } from '@/components/ui/icons';
import type { SkipInterval } from '@/core/api/aniskip';
import { RatingPicker } from '@/components/anime/rating-picker';
import { toast } from '@/components/ui/toast';
import { haptic } from '@/lib/haptics';
import { setImmersive, setNowPlayingMeta, setPlayerOpen } from '@/lib/native-media';
import { SakuraLoader } from './sakura-loader';

const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), { ssr: false });

const SKIP_LABEL: Record<SkipInterval['type'], string> = {
  op: "Passer l'opening",
  ed: "Passer l'ending",
  recap: 'Passer le récap',
  'mixed-op': "Passer l'opening",
  'mixed-ed': "Passer l'ending",
};

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
  /** Cover art for the system media controls (lock screen, Android notification). */
  artwork?: string | null;
  /** Play / pause from the video element (not reported by embedded iframe players). */
  onPlayingChange?: (playing: boolean) => void;
  /** The user's rating for this episode (1–10). */
  episodeRating?: number | null;
  onRateEpisode?: (rating: number | null) => void;
  /** Estimated duration in seconds (used for iframe players to track progress & end). */
  estimatedDuration?: number;
}

const NEXT_COUNTDOWN = 8;
/** Sakura intro shown when the player opens, before the episode. */
const INTRO_MS = 1500;
/** The end-of-episode rating card hides itself after this long. */
const RATE_PROMPT_MS = 12000;
const IDLE_MS = 3000;

function sourceName(s: PlayerSource, i: number) {
  if (s.url.includes('sibnet')) return 'Sibnet';
  if (s.url.includes('uqload')) return 'Uqload';
  if (s.url.includes('getvid') || s.url.includes('vip')) return 'VIP';
  return s.quality && s.quality !== 'Auto' ? s.quality : `Lecteur ${i + 1}`;
}

const AD_FREE = ' · sans pub';
/** Players read straight from their stream (src/lib/direct-stream.ts) carry this suffix. */
const splitName = (name: string) =>
  name.endsWith(AD_FREE) ? { name: name.slice(0, -AD_FREE.length), adFree: true } : { name, adFree: false };

/** Desktop shows the players as pills up to this many; beyond, and always on phones, a menu. */
const MAX_PILLS = 3;

/**
 * Player picker as a compact button + drop-down: a row of players hid the episode title on phones.
 */
function SourceMenu({
  sources,
  current,
  onSelect,
  hidden,
  className = '',
}: {
  sources: PlayerSource[];
  current: PlayerSource | null;
  onSelect: (s: PlayerSource) => void;
  /** Player chrome faded out: the menu closes with it. */
  hidden: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentIdx = Math.max(0, sources.findIndex((s) => s.url === current?.url));
  const currentName = splitName(sourceName(sources[currentIdx] ?? sources[0], currentIdx));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isOpen = open && !hidden;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          haptic('light');
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Lecteur : ${currentName.name}`}
        className="flex items-center gap-1 sm:gap-1.5 h-9 sm:h-11 px-2.5 sm:px-3.5 rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25 transition-colors cursor-pointer"
      >
        <MonitorPlay className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline max-w-[8rem] truncate text-xs font-semibold">{currentName.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Choisir un lecteur"
          className="absolute right-0 top-full mt-2 w-60 max-h-[min(60vh,320px)] overflow-y-auto rounded-2xl p-1.5 bg-white/15 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.25)] origin-top-right animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">Lecteur</div>
          {sources.map((s, i) => {
            const { name, adFree } = splitName(sourceName(s, i));
            const active = current?.url === s.url;
            return (
              <button
                key={s.url}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  haptic('selection');
                  setOpen(false);
                  if (!active) onSelect(s);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[15px] text-white transition-colors cursor-pointer ${
                  active ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'
                }`}
              >
                <span className="flex-1 min-w-0 truncate">{name}</span>
                {adFree && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-400/25 text-emerald-200 text-[10px] font-semibold">Sans pub</span>
                )}
                <Check className={`w-4 h-4 shrink-0 ${active ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const subscribeNoop = () => () => {};

const getFsElement = () => {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
};

const requestContainerFullscreen = async (target: HTMLElement): Promise<boolean> => {
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen();
      return true;
    }
    const anyTarget = target as any;
    if (anyTarget.webkitRequestFullscreen) {
      await anyTarget.webkitRequestFullscreen();
      return true;
    }
    if (anyTarget.webkitRequestFullScreen) {
      await anyTarget.webkitRequestFullScreen();
      return true;
    }
    if (anyTarget.mozRequestFullScreen) {
      await anyTarget.mozRequestFullScreen();
      return true;
    }
    if (anyTarget.msRequestFullscreen) {
      await anyTarget.msRequestFullscreen();
      return true;
    }
  } catch {}
  return false;
};

const exitContainerFullscreen = async (): Promise<boolean> => {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }
    const anyDoc = document as any;
    if (anyDoc.webkitExitFullscreen) {
      await anyDoc.webkitExitFullscreen();
      return true;
    }
    if (anyDoc.mozCancelFullScreen) {
      await anyDoc.mozCancelFullScreen();
      return true;
    }
    if (anyDoc.msExitFullscreen) {
      await anyDoc.msExitFullscreen();
      return true;
    }
  } catch {}
  return false;
};

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
  onPlayingChange,
  artwork,
  episodeRating = null,
  onRateEpisode,
  estimatedDuration,
}: PlayerOverlayProps) {
  // End-of-episode rating prompt: shown once per episode, never touches the next-episode countdown.
  const [ratePrompt, setRatePrompt] = useState<'hidden' | 'shown' | 'done'>('hidden');
  const [ratePromptManual, setRatePromptManual] = useState(false);
  const [isRateClosing, setIsRateClosing] = useState(false);
  const [promptFor, setPromptFor] = useState(episodeLabel);
  if (promptFor !== episodeLabel) {
    setPromptFor(episodeLabel);
    setRatePrompt('hidden');
    setRatePromptManual(false);
    setIsRateClosing(false);
  }
  const showRatePrompt = () => {
    if (onRateEpisode) {
      setRatePromptManual(false);
      setIsRateClosing(false);
      setRatePrompt((r) => (r === 'hidden' ? 'shown' : r));
    }
  };

  const handleCloseRating = (selectedRating?: number | null) => {
    if (isRateClosing) return;
    if (selectedRating != null && onRateEpisode) {
      onRateEpisode(selectedRating);
    }
    setIsRateClosing(true);
    setTimeout(() => {
      setRatePrompt('done');
      setRatePromptManual(false);
      setIsRateClosing(false);
    }, 280);
  };

  useEffect(() => {
    if (ratePrompt !== 'shown' || ratePromptManual || isRateClosing) return;
    const t = setTimeout(() => handleCloseRating(), RATE_PROMPT_MS);
    return () => clearTimeout(t);
  }, [ratePrompt, ratePromptManual, isRateClosing]);
  const [idle, setIdle] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSkipInfo, setActiveSkipInfo] = useState<{ skip: SkipInterval; onSkip: () => void } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  /** Full screen asked by the user: kept when the Fullscreen API fails (Android app hides the bars itself). */
  const fsRequested = useRef(false);

  // Sakura intro when the player opens (the episode loads underneath), then the same screen stays
  // while the video is being looked for, and fades out once it's there.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(t);
  }, []);
  const busy = intro || isLoading;
  const [loaderShown, setLoaderShown] = useState(true);
  if (busy && !loaderShown) setLoaderShown(true);
  useEffect(() => {
    if (busy) return;
    const t = setTimeout(() => setLoaderShown(false), 600);
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    const updateOrientation = (e?: Event) => {
      const landscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      const fsEl = getFsElement();
      // Leaving the real full screen (Échap, back gesture) ends the requested one too.
      if (e && e.type.toLowerCase().includes('fullscreenchange') && !fsEl && fsRequested.current) {
        fsRequested.current = false;
        setImmersive(false);
      }
      setIsFullscreen(!!fsEl || fsRequested.current);
      // If a child (e.g. iframe or video) entered fullscreen natively, promote fullscreen to overlayRef
      // so Sakura's controls, popups, and close button stay on the fullscreen top layer.
      if (fsEl && fsEl !== overlayRef.current && overlayRef.current?.contains(fsEl)) {
        requestContainerFullscreen(overlayRef.current).catch(() => {});
      }
    };
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    document.addEventListener('fullscreenchange', updateOrientation);
    document.addEventListener('webkitfullscreenchange', updateOrientation);
    document.addEventListener('mozfullscreenchange', updateOrientation);
    document.addEventListener('MSFullscreenChange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      document.removeEventListener('fullscreenchange', updateOrientation);
      document.removeEventListener('webkitfullscreenchange', updateOrientation);
      document.removeEventListener('mozfullscreenchange', updateOrientation);
      document.removeEventListener('MSFullscreenChange', updateOrientation);
    };
  }, []);

  // When switching phone to landscape while video plays, auto-request fullscreen if available
  useEffect(() => {
    if (isLandscape && playing && typeof window !== 'undefined' && window.innerHeight < 600 && !getFsElement()) {
      if (overlayRef.current) {
        requestContainerFullscreen(overlayRef.current).catch(() => {});
      }
    }
  }, [isLandscape, playing]);

  const toggleFullscreen = async () => {
    haptic('light');
    const fsEl = getFsElement();

    // Requested too: in the Android app the Fullscreen API can fail while the bars are hidden.
    if (fsEl || fsRequested.current) {
      fsRequested.current = false;
      setImmersive(false);
      if (fsEl) await exitContainerFullscreen();
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {}
      setIsFullscreen(false);
      return;
    }

    let success = false;
    if (overlayRef.current) {
      success = await requestContainerFullscreen(overlayRef.current);

      // Fallback for iOS video elements (Safari on iPhone only allows webkitEnterFullscreen on <video>)
      if (!success) {
        const video = overlayRef.current.querySelector('video') as any;
        if (video && typeof video.webkitEnterFullscreen === 'function') {
          try {
            video.webkitEnterFullscreen();
            success = true;
          } catch {}
        }
      }

      if (!success) {
        const iframe = overlayRef.current.querySelector('iframe');
        if (iframe) {
          success = await requestContainerFullscreen(iframe);
        }
      }
    }

    // Try orientation lock to landscape on mobile devices
    try {
      await (screen.orientation as any)?.lock?.('landscape');
    } catch {}

    fsRequested.current = true;
    setImmersive(true);
    setIsFullscreen(true);
  };

  const toggleFullscreenRef = useRef(toggleFullscreen);
  useEffect(() => {
    toggleFullscreenRef.current = toggleFullscreen;
  });

  // Android app: a phone turned sideways plays full screen, so the status bar goes away too.
  useEffect(() => {
    if (isLandscape && window.innerHeight < 600) setImmersive(true);
    else if (!getFsElement() && !fsRequested.current) setImmersive(false);
  }, [isLandscape]);
  useEffect(() => () => setImmersive(false), []);

  // System media controls (Android notification, lock screen, media keys): episode, anime, artwork,
  // « next ». Embedded iframe players keep their own (cross-origin), only direct videos use this.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);
  // Android app: notification + picture-in-picture when leaving the app (native-media.ts).
  useEffect(() => {
    setPlayerOpen(true);
    return () => setPlayerOpen(false);
  }, []);
  useEffect(() => {
    setNowPlayingMeta({ title: episodeLabel, artist: animeTitle, artwork: artwork || poster || undefined });
    return () => setNowPlayingMeta(null);
  }, [episodeLabel, animeTitle, artwork, poster]);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const art = [artwork, poster].filter((u): u is string => !!u);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episodeLabel,
      artist: animeTitle,
      album: 'SAKURA',
      artwork: art.map((src) => ({ src, sizes: '512x512' })),
    });
    try {
      navigator.mediaSession.setActionHandler('nexttrack', () => nextRef.current?.onPlay());
    } catch {
      /* unsupported action */
    }
    return () => {
      navigator.mediaSession.metadata = null;
      try {
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch {
        /* unsupported action */
      }
    };
  }, [episodeLabel, animeTitle, artwork, poster]);
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
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreenRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('player-open');
    document.body.classList.add('player-open');
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove('player-open');
      document.body.classList.remove('player-open');
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

  const handlePlayerError = (msg: string) => {
    console.warn('[player-overlay] video error:', msg);
    const currIdx = current ? sources.findIndex((s) => s.url === current.url) : -1;
    if (currIdx >= 0 && currIdx < sources.length - 1) {
      const nextSource = sources[currIdx + 1];
      toast(`Lecteur indisponible, bascule sur ${sourceName(nextSource, currIdx + 1)}…`);
      onSelectSource(nextSource);
    }
  };

  const handleNextSource = () => {
    const currIdx = current ? sources.findIndex((s) => s.url === current.url) : -1;
    if (sources.length > 1) {
      const nextIdx = (currIdx + 1) % sources.length;
      const nextSource = sources[nextIdx];
      toast(`Bascule sur ${sourceName(nextSource, nextIdx)}…`);
      onSelectSource(nextSource);
    }
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${animeTitle} — ${episodeLabel}`}
      className={`player-overlay fixed inset-0 z-[100] bg-black animate-in fade-in duration-300 ${chromeHidden ? 'cursor-none' : ''}`}
      onMouseMove={wake}
      onTouchStart={wake}
      onKeyDown={wake}
    >
      {/* Video / states */}
      <div onDoubleClick={toggleFullscreen} className="absolute inset-0 flex items-center justify-center">
        {loaderShown && (
          <SakuraLoader
            title={animeTitle}
            subtitle={episodeLabel}
            message={isLoading ? 'Recherche de la vidéo' : 'Préparation de l’épisode'}
            poster={poster}
            color={color}
            leaving={!busy}
          />
        )}
        {isLoading ? null : error ? (
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
            onError={handlePlayerError}
            onNextSource={sources.length > 1 ? handleNextSource : undefined}
            estimatedDuration={estimatedDuration}
            onProgress={(time, duration) => {
              onProgress(time, duration);
              if (duration > 0 && time / duration >= 0.9) showRatePrompt();
            }}
            onPlayingChange={(p) => {
              setPlaying(p);
              onPlayingChange?.(p);
              if (p) wake();
            }}
            onEnded={() => {
              showRatePrompt();
              if (next && autoNext) setCountdown(NEXT_COUNTDOWN);
            }}
            onActiveSkipChange={setActiveSkipInfo}
          />
        ) : null}
      </div>

      {/* Top chrome with a scrim so it stays readable over bright frames */}
      <div
        className={`absolute inset-x-0 top-0 z-[110] pointer-events-none transition-opacity duration-500 ${chromeHidden ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="absolute inset-x-0 top-0 h-24 sm:h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent" />
        <div className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-6 pt-[max(env(safe-area-inset-top),10px)] sm:pt-[max(var(--safe-top),16px)] pl-[max(env(safe-area-inset-left),12px)] pr-[max(env(safe-area-inset-right),12px)]">
          <button
            onClick={onClose}
            aria-label="Fermer le lecteur"
            className="pointer-events-auto shrink-0 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-white/70 text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">{animeTitle}</div>
            <div className="text-white text-xs sm:text-base md:text-lg font-bold line-clamp-2 sm:line-clamp-1 break-words leading-tight drop-shadow">{episodeLabel}</div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            {sources.length > 1 && (
              <SourceMenu
                sources={sources}
                current={current}
                onSelect={onSelectSource}
                hidden={chromeHidden}
                className={sources.length > MAX_PILLS ? '' : 'md:hidden'}
              />
            )}
            {sources.length > 1 && sources.length <= MAX_PILLS && (
              <div className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-md" role="radiogroup" aria-label="Lecteur">
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
            {onRateEpisode && (
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setRatePrompt((r) => {
                    if (r === 'shown') return 'hidden';
                    setRatePromptManual(true);
                    return 'shown';
                  });
                }}
                aria-label="Noter cet épisode"
                className={`flex items-center gap-1 h-9 sm:h-11 px-2.5 sm:px-3.5 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
                  episodeRating != null ? 'bg-amber-400 text-black font-bold' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={episodeRating != null ? `Note : ${episodeRating}/10` : 'Noter cet épisode'}
              >
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className={`text-[11px] sm:text-xs font-semibold ${episodeRating != null ? '' : 'hidden sm:inline'}`}>{episodeRating != null ? `${episodeRating}/10` : 'Noter'}</span>
              </button>
            )}
            {next && (
              <button
                onClick={() => {
                  haptic('medium');
                  if (onRateEpisode && episodeRating == null && ratePrompt !== 'done') {
                    showRatePrompt();
                  }
                  next.onPlay();
                }}
                className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-11 px-3 sm:px-4 rounded-full bg-white/15 backdrop-blur-md text-white font-semibold text-xs sm:text-sm hover:bg-white/25 transition-colors cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Suivant</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* End-of-episode rating (bottom-left, independent from the up-next card) */}
      {(ratePrompt === 'shown' || isRateClosing) && onRateEpisode && (
        <div
          className={`absolute z-[120] left-3 sm:left-4 md:left-10 bottom-16 sm:bottom-24 w-[min(90vw,340px)] p-3.5 sm:p-4 rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl pl-[max(env(safe-area-inset-left),12px)] transition-all duration-300 ease-out ${
            isRateClosing
              ? 'opacity-0 translate-y-6 scale-95 pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-4'
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Noter cet épisode</div>
            <button
              onClick={() => handleCloseRating()}
              aria-label="Fermer"
              className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <RatingPicker
            value={episodeRating}
            size="sm"
            label="Note de cet épisode"
            onChange={(r) => handleCloseRating(r)}
          />
        </div>
      )}

      {/* Up-next card */}
      {countdown !== null && next && (
        <div className="absolute z-[120] right-3 sm:right-6 md:right-10 bottom-16 sm:bottom-24 w-[min(90vw,360px)] p-4 sm:p-5 rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 pr-[max(env(safe-area-inset-right),12px)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/60">Épisode suivant dans {countdown} s</div>
              <div className="font-bold text-sm sm:text-base mt-1 line-clamp-2">{next.label}</div>
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
            className="mt-4 w-full h-10 sm:h-11 rounded-full bg-white text-black font-bold text-xs sm:text-sm cursor-pointer"
          >
            Lire maintenant
          </button>
        </div>
      )}

      {/* Skip opening / ending button */}
      {activeSkipInfo && countdown === null && (
        <button
          type="button"
          onClick={activeSkipInfo.onSkip}
          className="absolute bottom-16 sm:bottom-24 right-4 sm:right-6 md:right-10 z-[125] pointer-events-auto flex items-center gap-2 sm:gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-white text-black text-xs sm:text-sm font-bold shadow-2xl hover:scale-105 active:scale-95 transition-transform animate-in fade-in slide-in-from-bottom-4 cursor-pointer pr-[max(env(safe-area-inset-right),16px)]"
        >
          <FastForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
          <span>{SKIP_LABEL[activeSkipInfo.skip.type]}</span>
        </button>
      )}
    </div>
  );
}
