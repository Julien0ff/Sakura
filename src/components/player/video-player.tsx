'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { usePlyr, APITypes } from 'plyr-react';
import 'plyr-react/plyr.css';
import Hls from 'hls.js';
import { FastForward, X } from '@/components/ui/icons';
import type { SkipInterval } from '@/core/api/aniskip';
import { haptic } from '@/lib/haptics';
import { onNativeMediaAction, setNowPlayingState } from '@/lib/native-media';

export interface VideoPlayerProps {
  src: string;
  type?: 'hls' | 'mp4' | 'youtube' | 'iframe';
  poster?: string;
  title?: string;
  /** Resume position in seconds (ignored if it is within the last 30 s). */
  startAt?: number;
  /** Opening / ending intervals (AniSkip). */
  skipTimes?: SkipInterval[];
  /** Skip intervals automatically instead of showing a button. */
  autoSkip?: boolean;
  /** Throttled (~every 5 s, plus on pause/end). */
  onProgress?: (time: number, duration: number) => void;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (message: string) => void;
  onNextSource?: () => void;
  /** Estimated episode duration in seconds (for iframe players). */
  estimatedDuration?: number;
  /** Callback when an opening / ending is active, so PlayerOverlay can render the button. */
  onActiveSkipChange?: (info: { skip: SkipInterval; onSkip: () => void } | null) => void;
}

export const SKIP_LABEL: Record<SkipInterval['type'], string> = { op: "Passer l'opening", ed: "Passer l'ending" };

export function VideoPlayer({
  src,
  type = 'hls',
  poster,
  title,
  startAt = 0,
  skipTimes = [],
  autoSkip = false,
  onProgress,
  onEnded,
  onPlayingChange,
  onError,
  onNextSource,
  estimatedDuration,
  onActiveSkipChange,
}: VideoPlayerProps) {
  const plyrRef = useRef<APITypes>(null);
  const hlsRef = useRef<Hls | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSkip, setActiveSkip] = useState<SkipInterval | null>(null);
  const [iframeLoading, setIframeLoading] = useState(type === 'iframe');
  const [slowIframe, setSlowIframe] = useState(false);
  const [iframeSeekTime, setIframeSeekTime] = useState<number | null>(null);

  const isAnimeSama = Boolean(src && (src.includes('ansembed') || src.includes('anime-sama')));

  // Anime-Sama embeds start with a 4s intro bumper. When starting from 0, jump directly past it.
  const iframeSrc = useMemo(() => {
    const target = iframeSeekTime ?? (startAt > 4 ? startAt : (isAnimeSama ? 4 : 0));
    if (isAnimeSama) {
      const clean = src.replace(/([?&])start=\d+/, '').replace(/#t=\d+/, '');
      const joiner = clean.includes('?') ? '&' : '?';
      const t = Math.max(target, 4);
      return `${clean}${joiner}start=${Math.floor(t)}#t=${Math.floor(t)}`;
    }
    if (target > 0) {
      const clean = src.replace(/#t=\d+/, '');
      return `${clean}#t=${Math.floor(target)}`;
    }
    return src;
  }, [src, isAnimeSama, startAt, iframeSeekTime]);

  // Elapsed playhead for iframes
  const elapsedRef = useRef(startAt || (isAnimeSama ? 4 : 0));
  useEffect(() => {
    elapsedRef.current = startAt || (isAnimeSama ? 4 : 0);
    setIframeSeekTime(null);
  }, [src, startAt, isAnimeSama]);

  const doIframeSeek = useCallback(
    (time: number) => {
      elapsedRef.current = time;
      latest.current.onProgress?.(time, estimatedDuration || 1440);
      setIframeSeekTime(time);

      try {
        const win = iframeRef.current?.contentWindow;
        if (win) {
          win.postMessage({ type: 'seek', time }, '*');
          win.postMessage({ event: 'command', func: 'seekTo', args: [time, true] }, '*');
          win.postMessage({ method: 'setCurrentTime', value: time }, '*');
          win.postMessage(JSON.stringify({ event: 'seek', val: time }), '*');
        }
      } catch {
        /* cross-origin error */
      }

      if (iframeRef.current) {
        try {
          const u = new URL(iframeRef.current.src);
          u.hash = `t=${Math.floor(time)}`;
          if (u.searchParams.has('start')) {
            u.searchParams.set('start', String(Math.floor(time)));
          }
          iframeRef.current.src = u.toString();
        } catch {
          const base = iframeRef.current.src.split('#')[0];
          iframeRef.current.src = `${base}#t=${Math.floor(time)}`;
        }
      }
    },
    [estimatedDuration]
  );

  useEffect(() => {
    setIframeLoading(type === 'iframe');
    setSlowIframe(false);
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (type !== 'iframe') return;

    // Only alert after 12s if the iframe has NOT loaded yet
    slowTimerRef.current = setTimeout(() => {
      setSlowIframe(true);
    }, 12000);

    return () => {
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
    };
  }, [src, type]);

  // For iframe players (cartoons / AnimeSama embeds):
  // 1. Listen for postMessage events ('ended', 'finish', 'complete')
  // 2. Track elapsed watch time to periodically report progress, check AniSkip intervals & trigger auto-next
  useEffect(() => {
    if (type !== 'iframe') return;

    latest.current.onPlayingChange?.(true);

    const onMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const evt = String(data?.event || data?.type || data?.action || '');
        if (/ended|finish|complete/i.test(evt)) {
          latest.current.onEnded?.();
        }
      } catch {
        // Ignore non-json or unrelated messages
      }
    };
    window.addEventListener('message', onMessage);

    const duration = estimatedDuration && estimatedDuration > 0 ? estimatedDuration : 1440;
    const skipped = new Set<string>();
    let endedFired = false;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      elapsedRef.current += 1;
      const elapsed = elapsedRef.current;

      // Check AniSkip interval
      const current = latest.current.skipTimes.find((s) => elapsed >= s.start && elapsed < s.end - 1) ?? null;
      if (current && latest.current.autoSkip && !skipped.has(current.type)) {
        skipped.add(current.type);
        doIframeSeek(current.end);
        setActiveSkip(null);
      } else {
        setActiveSkip((prev) => (prev?.type === current?.type && prev?.start === current?.start ? prev : current));
      }

      if (elapsed % 5 === 0) {
        latest.current.onProgress?.(elapsed, duration);
      }

      if (!endedFired && elapsed >= duration) {
        endedFired = true;
        latest.current.onEnded?.();
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(interval);
      latest.current.onPlayingChange?.(false);
      setActiveSkip(null);
    };
  }, [type, estimatedDuration, isAnimeSama, doIframeSeek]);

  // Latest callbacks/values in refs so media listeners don't need re-binding.
  const latest = useRef({
    onProgress,
    onEnded,
    onPlayingChange,
    onError,
    onNextSource,
    skipTimes,
    autoSkip,
    startAt,
    onActiveSkipChange,
  });
  useEffect(() => {
    latest.current = {
      onProgress,
      onEnded,
      onPlayingChange,
      onError,
      onNextSource,
      skipTimes,
      autoSkip,
      startAt,
      onActiveSkipChange,
    };
  });

  const videoRef = usePlyr(
    plyrRef,
    {
      source:
        type === 'youtube'
          ? { type: 'video', sources: [{ src, provider: 'youtube' }] }
          : {
              type: 'video',
              title: title || 'Vidéo',
              poster,
              sources: [{ src, type: type === 'mp4' ? 'video/mp4' : 'application/x-mpegURL' }],
            },
      options: {
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay'],
        fullscreen: { enabled: false },
        settings: ['quality', 'speed'],
        quality: {
          default: 0,
          options: [0, 1080, 720, 480, 360],
          forced: true,
          onChange: (q: number) => {
            const hls = hlsRef.current;
            if (!hls) return;
            hls.currentLevel = q === 0 ? -1 : hls.levels.findIndex((l) => l.height === q);
          },
        },
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        seekTime: 10,
        i18n: {
          speed: 'Vitesse',
          quality: 'Qualité',
          normal: 'Normale',
          qualityLabel: { 0: 'Auto' },
          play: 'Lecture',
          pause: 'Pause',
          mute: 'Couper le son',
          unmute: 'Activer le son',
          enterFullscreen: 'Plein écran',
          exitFullscreen: 'Quitter le plein écran',
          settings: 'Réglages',
        },
      },
    },
    [src, type, title, poster]
  ) as React.Ref<HTMLVideoElement>;

  const getMedia = () => (plyrRef.current?.plyr as unknown as { media?: HTMLVideoElement } | undefined)?.media;

  // Wait for Plyr to mount the <video>, then wire HLS + listeners.
  useEffect(() => {
    if (type === 'iframe' || type === 'youtube') return;
    let video: HTMLVideoElement | undefined;
    let attempts = 0;
    let lastReport = 0;
    let resumed = false;
    const skipped = new Set<string>();

    const report = (force = false) => {
      if (!video || !video.duration || !isFinite(video.duration)) return;
      const now = Date.now();
      if (!force && now - lastReport < 5000) return;
      lastReport = now;
      latest.current.onProgress?.(video.currentTime, video.duration);
    };

    let startupWatchdog: ReturnType<typeof setTimeout> | undefined;

    const onLoaded = () => {
      clearTimeout(startupWatchdog);
      if (!video || resumed) return;
      resumed = true;
      const { startAt: at } = latest.current;
      const initialTime = at > 5 && video.duration && at < video.duration - 30 ? at : (isAnimeSama ? 4 : 0);
      if (initialTime > 0) video.currentTime = initialTime;
    };

    const onTime = () => {
      if (!video) return;
      const t = video.currentTime;
      const current = latest.current.skipTimes.find((s) => t >= s.start && t < s.end - 1) ?? null;
      if (current && latest.current.autoSkip && !skipped.has(current.type)) {
        skipped.add(current.type);
        video.currentTime = current.end;
        setActiveSkip(null);
      } else {
        setActiveSkip((prev) => (prev?.type === current?.type && prev?.start === current?.start ? prev : current));
      }
      report();
      if (Date.now() - lastPosition > 5000) {
        lastPosition = Date.now();
        syncPosition();
      }
    };
    // System media controls (notification, lock screen, headset): state, position, actions.
    // The metadata (episode, anime, artwork) is set by <PlayerOverlay/>.
    const session = typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
    const syncPosition = () => {
      if (!video?.duration || !isFinite(video.duration)) return;
      setNowPlayingState({ playing: !video.paused, position: video.currentTime, duration: video.duration });
      if (!session) return;
      try {
        session.setPositionState({ duration: video.duration, position: Math.min(video.currentTime, video.duration), playbackRate: video.playbackRate || 1 });
      } catch {
        /* invalid state while seeking */
      }
    };
    let lastPosition = 0;
    const onPause = () => {
      report(true);
      latest.current.onPlayingChange?.(false);
      if (session) session.playbackState = 'paused';
      syncPosition();
    };
    const onPlay = () => {
      latest.current.onPlayingChange?.(true);
      if (session) session.playbackState = 'playing';
      syncPosition();
    };
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => void video?.play()],
      ['pause', () => video?.pause()],
      ['seekbackward', (d) => video && (video.currentTime = Math.max(0, video.currentTime - (d.seekOffset ?? 10)))],
      ['seekforward', (d) => video && (video.currentTime = Math.min(video.duration || Infinity, video.currentTime + (d.seekOffset ?? 10)))],
      ['seekto', (d) => video && d.seekTime != null && (video.currentTime = d.seekTime)],
    ];
    // Same actions from the Android app's notification.
    const offNative = onNativeMediaAction(({ action, time }) => {
      const handler = actions.find(([a]) => a === action)?.[1];
      handler?.({ action, seekTime: time } as MediaSessionActionDetails);
    });
    const setActions = (on: boolean) => {
      for (const [action, handler] of actions) {
        try {
          session?.setActionHandler(action, on ? handler : null);
        } catch {
          /* action not supported by this browser */
        }
      }
    };
    const onEnd = () => {
      report(true);
      latest.current.onEnded?.();
    };

    const onVideoError = () => {
      const err = video?.error;
      console.warn('[video-player] playback error', err);
      latest.current.onError?.(err?.message || 'Erreur de lecture du lecteur vidéo.');
    };

    let networkRetries = 0;
    const attach = () => {
      video = getMedia();
      if (!video) {
        if (++attempts <= 50) timer = setTimeout(attach, 100);
        return;
      }

      // If playback fails to start within 7s (e.g. stalled/blocked HLS), switch to next source
      startupWatchdog = setTimeout(() => {
        if (video && video.readyState < 2 && !video.currentTime && !resumed) {
          console.warn('[video-player] Startup watchdog fired, auto-failing over to next source');
          latest.current.onError?.('Délai de chargement dépassé');
        }
      }, 7000);

      if (type === 'hls' && Hls.isSupported()) {
        hlsRef.current?.destroy();
        const hls = new Hls({ capLevelToPlayerSize: false });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.warn('[video-player] HLS fatal error:', data.type, data.details);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (++networkRetries <= 2) {
                  hls.startLoad();
                } else {
                  hls.destroy();
                  latest.current.onError?.('Erreur réseau du flux HLS');
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                latest.current.onError?.(data.details || 'Erreur de lecture du flux');
                break;
            }
          }
        });
      }
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('pause', onPause);
      video.addEventListener('play', onPlay);
      video.addEventListener('ended', onEnd);
      video.addEventListener('error', onVideoError);
      video.addEventListener('seeked', syncPosition);
      video.addEventListener('ratechange', syncPosition);
      video.addEventListener('durationchange', syncPosition);
      // iPhone / iPad: leaving Safari (or the app) while it plays continues in picture-in-picture.
      video.setAttribute('autopictureinpicture', '');
      setActions(true);
      if (video.readyState >= 1) onLoaded();
    };

    let timer = setTimeout(attach, 50);

    return () => {
      clearTimeout(timer);
      clearTimeout(startupWatchdog);
      report(true);
      video?.removeEventListener('loadedmetadata', onLoaded);
      video?.removeEventListener('timeupdate', onTime);
      video?.removeEventListener('pause', onPause);
      video?.removeEventListener('play', onPlay);
      video?.removeEventListener('ended', onEnd);
      video?.removeEventListener('error', onVideoError);
      video?.removeEventListener('seeked', syncPosition);
      video?.removeEventListener('ratechange', syncPosition);
      video?.removeEventListener('durationchange', syncPosition);
      setActions(false);
      offNative();
      setNowPlayingState(null);
      if (session) session.playbackState = 'none';
      hlsRef.current?.destroy();
      hlsRef.current = null;
      setActiveSkip(null);
    };
  }, [src, type]);

  const skip = useCallback(() => {
    haptic('light');
    if (activeSkip) {
      if (type === 'iframe') {
        doIframeSeek(activeSkip.end);
      } else {
        const video = getMedia();
        if (video) video.currentTime = activeSkip.end;
      }
      setActiveSkip(null);
    }
  }, [activeSkip, type, doIframeSeek]);

  useEffect(() => {
    latest.current.onActiveSkipChange?.(activeSkip ? { skip: activeSkip, onSkip: skip } : null);
  }, [activeSkip, skip]);

  return (
    <div className="relative w-full h-full bg-black">
      {type === 'iframe' ? (
        <>
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 z-10 pointer-events-none">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white/80 text-sm">Chargement du lecteur…</p>
            </div>
          )}
          {slowIframe && (
            <div className="absolute top-[max(var(--safe-top),16px)] left-1/2 -translate-x-1/2 z-[115] h-11 flex items-center gap-2.5 px-4 rounded-full bg-black/85 backdrop-blur-xl border border-white/20 text-white text-xs shadow-2xl animate-in fade-in max-w-[90vw]">
              <span className="truncate">Le lecteur tarde à répondre ?</span>
              {latest.current.onNextSource && (
                <button
                  type="button"
                  onClick={() => {
                    setSlowIframe(false);
                    latest.current.onNextSource?.();
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-white text-black font-semibold cursor-pointer hover:bg-white/90 transition-colors"
                >
                  Essayer un autre lecteur
                </button>
              )}
              <button
                type="button"
                onClick={() => setSlowIframe(false)}
                aria-label="Fermer la suggestion"
                className="shrink-0 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            onLoad={() => {
              if (slowTimerRef.current) {
                clearTimeout(slowTimerRef.current);
                slowTimerRef.current = null;
              }
              setIframeLoading(false);
              setSlowIframe(false);
            }}
            onError={() => {
              if (slowTimerRef.current) {
                clearTimeout(slowTimerRef.current);
                slowTimerRef.current = null;
              }
              setIframeLoading(false);
              latest.current.onError?.("Erreur de chargement de l'iframe.");
            }}
          />
        </>
      ) : (
        <div className="w-full h-full" key={src}>
          <video
            ref={videoRef}
            className="plyr-react plyr"
            playsInline
            {...({ 'webkit-playsinline': 'true', 'x5-playsinline': 'true' } as any)}
          />
        </div>
      )}
      {activeSkip && !onActiveSkipChange && (
        <button
          type="button"
          onClick={skip}
          className="absolute bottom-24 right-6 md:right-10 z-[125] pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black text-sm font-bold shadow-2xl hover:scale-105 active:scale-95 transition-transform animate-in fade-in slide-in-from-bottom-4 cursor-pointer"
        >
          <FastForward className="w-4 h-4" fill="currentColor" />
          {SKIP_LABEL[activeSkip.type]}
        </button>
      )}
    </div>
  );
}
