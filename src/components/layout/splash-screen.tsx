'use client';

import { useEffect, useRef, useState } from 'react';

/** The whole bloom (petals, stamens, name) plus a moment to look at it. */
const MIN_VISIBLE_MS = 3000;
/** Never block the site: a page that never fires `load` (stuck video host…) still opens. */
const MAX_VISIBLE_MS = 6000;
/** Matches the staged exit in globals.css (petals fly off, then the veil dissolves). */
const EXIT_MS = 1500;

/** Back on the site after this long in the background (tab hidden, phone locked, app switcher). */
const RESUME_AFTER_MS = 30_000;

const ANGLES = [0, 72, 144, 216, 288];
/** The logo's petals: three pinks, so the overlapping petals read apart (as on icon.png). */
const PETAL_FILLS = ['url(#sp-g0)', 'url(#sp-g1)', 'url(#sp-g2)', 'url(#sp-g0)', 'url(#sp-g1)'];
/** A petal of the logo, pointing up from the center (50, 50): broad, rounded, notched tip. */
const PETAL_D = 'M50 52C35 45 26.5 33 28.5 21.5 30.2 12.5 37 7.6 43.6 8.6L50 15.4 56.4 8.6C63 7.6 69.8 12.5 71.5 21.5 73.5 33 65 45 50 52Z';
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
          {/* The flower of the logo (public/icon.png without its frame), drawn so it can bloom. */}
          <svg className="splash-flower" viewBox="0 0 100 100" aria-hidden>
            <defs>
              <linearGradient id="sp-g0" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FF8FB8" />
                <stop offset="1" stopColor="#FF6B9E" />
              </linearGradient>
              <linearGradient id="sp-g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFB3CD" />
                <stop offset="1" stopColor="#FF8DB4" />
              </linearGradient>
              <linearGradient id="sp-g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FF6E9F" />
                <stop offset="1" stopColor="#FF4F8A" />
              </linearGradient>
            </defs>
            <g stroke="#C9497C" strokeOpacity="0.55" strokeWidth="0.9" strokeLinejoin="round">
              {ANGLES.map((angle, i) => (
                <g key={angle} transform={`rotate(${angle} 50 50) translate(0 -1)`}>
                  <path className="splash-petal" style={{ animationDelay: `${0.05 + i * 0.09}s` }} d={PETAL_D} fill={PETAL_FILLS[i]} />
                </g>
              ))}
            </g>
            <g fill="#FF2D6F">
              {ANGLES.map((angle, i) => (
                <g key={angle} transform={`rotate(${angle + 36} 50 50)`}>
                  <rect className="splash-mark" style={{ animationDelay: `${0.95 + i * 0.05}s` }} x="49" y="37" width="2" height="5" rx="1" />
                </g>
              ))}
            </g>
            <g stroke="#E4E4EA" strokeWidth="2.4" strokeLinecap="round">
              {ANGLES.map((angle, i) => (
                <g key={angle} transform={`rotate(${angle} 50 50)`}>
                  <path className="splash-stamen" style={{ animationDelay: `${0.6 + i * 0.05}s` }} d="M50 50V31" pathLength={1} />
                </g>
              ))}
            </g>
            <g fill="#D6D6DC">
              {ANGLES.map((angle, i) => (
                <g key={angle} transform={`rotate(${angle} 50 50)`}>
                  <circle className="splash-dot" style={{ animationDelay: `${0.8 + i * 0.05}s` }} cx="50" cy="30" r="3.4" />
                </g>
              ))}
            </g>
          </svg>
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
