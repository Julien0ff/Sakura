'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlyr, APITypes } from 'plyr-react';
import 'plyr-react/plyr.css';
import Hls from 'hls.js';
import { FastForward } from 'lucide-react';
import type { SkipInterval } from '@/core/api/aniskip';
import { haptic } from '@/lib/haptics';

interface VideoPlayerProps {
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
}

const SKIP_LABEL: Record<SkipInterval['type'], string> = { op: "Passer l'opening", ed: "Passer l'ending" };

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
}: VideoPlayerProps) {
  const plyrRef = useRef<APITypes>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [activeSkip, setActiveSkip] = useState<SkipInterval | null>(null);

  // Latest callbacks/values in refs so media listeners don't need re-binding.
  const latest = useRef({ onProgress, onEnded, onPlayingChange, skipTimes, autoSkip, startAt });
  useEffect(() => {
    latest.current = { onProgress, onEnded, onPlayingChange, skipTimes, autoSkip, startAt };
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
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
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

    const onLoaded = () => {
      if (!video || resumed) return;
      resumed = true;
      const { startAt: at } = latest.current;
      if (at > 5 && video.duration && at < video.duration - 30) video.currentTime = at;
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
    };
    const onPause = () => {
      report(true);
      latest.current.onPlayingChange?.(false);
    };
    const onPlay = () => latest.current.onPlayingChange?.(true);
    const onEnd = () => {
      report(true);
      latest.current.onEnded?.();
    };

    const attach = () => {
      video = getMedia();
      if (!video) {
        if (++attempts <= 50) timer = setTimeout(attach, 100);
        return;
      }
      if (type === 'hls' && Hls.isSupported()) {
        hlsRef.current?.destroy();
        const hls = new Hls({ capLevelToPlayerSize: false });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
      }
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('pause', onPause);
      video.addEventListener('play', onPlay);
      video.addEventListener('ended', onEnd);
      if (video.readyState >= 1) onLoaded();
    };

    let timer = setTimeout(attach, 50);

    return () => {
      clearTimeout(timer);
      report(true);
      video?.removeEventListener('loadedmetadata', onLoaded);
      video?.removeEventListener('timeupdate', onTime);
      video?.removeEventListener('pause', onPause);
      video?.removeEventListener('play', onPlay);
      video?.removeEventListener('ended', onEnd);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      setActiveSkip(null);
    };
  }, [src, type]);

  const skip = () => {
    haptic('light');
    const video = getMedia();
    if (video && activeSkip) video.currentTime = activeSkip.end;
    setActiveSkip(null);
  };

  return (
    <div className="relative w-full h-full bg-black">
      {type === 'iframe' ? (
        <iframe src={src} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin" />
      ) : (
        <div className="w-full h-full" key={src}>
          <video ref={videoRef} className="plyr-react plyr" playsInline />
        </div>
      )}
      {activeSkip && (
        <button
          onClick={skip}
          className="absolute bottom-24 right-6 md:right-10 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black text-sm font-bold shadow-2xl hover:scale-105 active:scale-95 transition-transform animate-in fade-in slide-in-from-bottom-4 cursor-pointer"
        >
          <FastForward className="w-4 h-4" fill="currentColor" />
          {SKIP_LABEL[activeSkip.type]}
        </button>
      )}
    </div>
  );
}
