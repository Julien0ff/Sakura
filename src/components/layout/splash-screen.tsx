'use client';

import { useEffect, useState } from 'react';

/** Shown once per launch (tab / app session), not on every reload inside it. */
const SESSION_KEY = 'sakura.splashShown';
/** The whole bloom (petals, stamens, name) plus a moment to look at it. */
const MIN_VISIBLE_MS = 3000;
/** Never block the site: a page that never fires `load` (stuck video host…) still opens. */
const MAX_VISIBLE_MS = 6000;
/** Matches the staged exit in globals.css (petals fly off, then the veil dissolves). */
const EXIT_MS = 1500;

/**
 * Runs before the first paint (in <head>): skips the splash when it was already shown in this
 * session, so a reload doesn't flash it. Kept tiny and dependency-free.
 */
export const splashBootScript = `try{if(sessionStorage.getItem('${SESSION_KEY}'))document.documentElement.classList.add('splash-skip')}catch(e){}`;

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
/** A replay stays a little longer than a real launch, to really see it. */
const REPLAY_VISIBLE_MS = 3200;

export function SplashScreen() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown');
  /** Remounts the markup so every animation starts over. */
  const [run, setRun] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onReplay = () => {
      timers.forEach(clearTimeout);
      const root = document.documentElement;
      root.classList.remove('splash-skip', 'splash-reveal');
      setRun((r) => r + 1);
      setPhase('shown');
      timers.push(
        setTimeout(() => {
          setPhase('leaving');
          root.classList.add('splash-reveal');
          timers.push(
            setTimeout(() => {
              setPhase('gone');
              root.classList.remove('splash-reveal');
            }, EXIT_MS)
          );
        }, REPLAY_VISIBLE_MS)
      );
    };
    window.addEventListener(SPLASH_REPLAY_EVENT, onReplay);
    return () => {
      window.removeEventListener(SPLASH_REPLAY_EVENT, onReplay);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Already shown this session: html.splash-skip keeps it hidden (display: none), nothing to run.
    if (root.classList.contains('splash-skip')) return;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* private mode: shown again next time, harmless */
    }

    let done = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const leave = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
      timers.push(
        setTimeout(() => {
          setPhase('leaving');
          root.classList.add('splash-reveal');
          timers.push(
            setTimeout(() => {
              setPhase('gone');
              root.classList.remove('splash-reveal');
            }, EXIT_MS)
          );
        }, wait)
      );
    };

    if (document.readyState === 'complete') leave();
    else window.addEventListener('load', leave, { once: true });
    timers.push(setTimeout(leave, MAX_VISIBLE_MS));

    return () => {
      window.removeEventListener('load', leave);
      timers.forEach(clearTimeout);
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
