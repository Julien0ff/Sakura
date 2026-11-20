'use client';

import { useEffect, useState } from 'react';

/** Shown once per launch (tab / app session), not on every reload inside it. */
const SESSION_KEY = 'sakura.splashShown';
/** Long enough to see the flower bloom, short enough not to slow anyone down. */
const MIN_VISIBLE_MS = 1300;
/** Never block the site: a page that never fires `load` (stuck video host…) still opens. */
const MAX_VISIBLE_MS = 6000;
const EXIT_MS = 750;

/**
 * Runs before the first paint (in <head>): skips the splash when it was already shown in this
 * session, so a reload doesn't flash it. Kept tiny and dependency-free.
 */
export const splashBootScript = `try{if(sessionStorage.getItem('${SESSION_KEY}'))document.documentElement.classList.add('splash-skip')}catch(e){}`;

const PETALS = [0, 72, 144, 216, 288];
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

export function SplashScreen() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown');

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
    <div className={`splash ${phase === 'leaving' ? 'splash-leaving' : ''}`} role="status" aria-label="Chargement de SAKURA">
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
        <svg className="splash-flower" viewBox="0 0 24 24" aria-hidden>
          <defs>
            <linearGradient id="splash-petal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFC2D6" />
              <stop offset="100%" stopColor="#FF5C93" />
            </linearGradient>
          </defs>
          {PETALS.map((angle, i) => (
            <g key={angle} transform={`rotate(${angle} 12 12)`}>
              <path
                className="splash-petal"
                style={{ animationDelay: `${0.08 + i * 0.09}s` }}
                d="M12 12.6C6.4 10.8 6 4.4 9.3 2.5L12 4.5 14.7 2.5C18 4.4 17.6 10.8 12 12.6Z"
                fill="url(#splash-petal)"
              />
            </g>
          ))}
          <circle className="splash-heart" cx="12" cy="12" r="1.9" fill="#FFF4F8" />
        </svg>

        <div className="splash-word" style={{ fontFamily: 'var(--font-impact)' }}>
          {'SAKURA'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.55 + i * 0.06}s` }}>
              {ch}
            </span>
          ))}
        </div>

        <div className="splash-bar" aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}
