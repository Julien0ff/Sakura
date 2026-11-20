'use client';

import { useEffect, useRef, useState } from 'react';
import { SakuraFlower } from '@/components/ui/sakura-flower';

/** The whole bloom (petals, stamens, name) plus a moment to look at it. */
const MIN_VISIBLE_MS = 3000;
/** Never block the site: a page that never fires `load` (stuck video host…) still opens. */
const MAX_VISIBLE_MS = 6000;
/** Matches the staged exit in globals.css (petals fly off, then the veil dissolves). */
const EXIT_MS = 1500;

/** Back on the site after this long in the background (tab hidden, phone locked, app switcher). */
const RESUME_AFTER_MS = 30_000;

/** Falling petals: horizontal start, delay, duration, drift (deterministic: same markup on server and client). */
const FALLING = [
  [8, 0.1, 5.2, 40],
  [22, 1.4, 6.1, -30],
  [37, 0.6, 4.8, 55],
  [55, 2.1, 5.6, -45],
  [68, 0.3, 6.4, 35],
  [81, 1.7, 5.0, -25],
  [93, 0.9, 5.8, 30],
] as const;

/** Paramètres › « Revoir l’écran de chargement »: plays it again (for feedback / fun). */
export const SPLASH_REPLAY_EVENT = 'sakura:splash-replay';
export function replaySplash() {
  window.dispatchEvent(new Event(SPLASH_REPLAY_EVENT));
}
/** Replays (coming back, Paramètres › Revoir): the whole bloom and a moment to look at it. */
const REPLAY_VISIBLE_MS = 3200;

/**
 * Shown on every full page load (refresh, any page), when coming back to the site after it sat in
 * the background, and on demand (Paramètres › Revoir). Never over an open player.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown');
  /** Remounts the markup so every animation starts over. */
  const [run, setRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
    const exit = () => {
      setPhase('leaving');
      root.classList.add('splash-reveal');
      later(() => {
        setPhase('gone');
        root.classList.remove('splash-reveal');
      }, EXIT_MS);
    };
    /** Plays it again from the first petal, then leaves after `visibleMs`. */
    const play = (visibleMs: number) => {
      // Coming back to an episode (picture-in-picture, paused tab): the video stays in front.
      if (root.classList.contains('player-open')) return;
      clear();
      root.classList.remove('splash-reveal');
      setRun((r) => r + 1);
      setPhase('shown');
      later(exit, visibleMs);
    };

    // ── Page load: leaves once the page has loaded, after the whole bloom (3 s from navigation).
    let loaded = false;
    const onLoad = () => {
      if (loaded) return;
      loaded = true;
      later(exit, Math.max(0, MIN_VISIBLE_MS - performance.now()));
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    later(onLoad, MAX_VISIBLE_MS);

    // ── Back after a pause in the background, or restored from the browser's back/forward cache.
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= RESUME_AFTER_MS) play(REPLAY_VISIBLE_MS);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) play(REPLAY_VISIBLE_MS);
    };
    const onReplay = () => play(REPLAY_VISIBLE_MS);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener(SPLASH_REPLAY_EVENT, onReplay);
    return () => {
      clear();
      window.removeEventListener('load', onLoad);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener(SPLASH_REPLAY_EVENT, onReplay);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div key={run} className={`splash ${phase === 'leaving' ? 'splash-leaving' : ''}`} role="status" aria-label="Chargement de SAKURA">
      <div className="splash-glow" aria-hidden />

      <div className="splash-falling" aria-hidden>
        {FALLING.map(([left, delay, duration, drift], i) => (
          <span
            key={i}
            style={
              {
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                '--drift': `${drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="splash-center">
        <div className="splash-flower-wrap">
          <span className="splash-halo" aria-hidden />
          <span className="splash-halo splash-halo-2" aria-hidden />
          <SakuraFlower className="splash-flower" />
        </div>

        <div className="splash-word" style={{ fontFamily: 'var(--font-impact)' }}>
          {'SAKURA'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.55 + i * 0.06}s` }}>
              {ch}
            </span>
          ))}
        </div>

        <p className="splash-tagline">Animes en VF &amp; VOSTFR</p>

        <div className="splash-bar" aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}
