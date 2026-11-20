import { useId } from 'react';

const ANGLES = [0, 72, 144, 216, 288];
/** A petal of the logo, pointing up from the center (50, 50): broad, rounded, notched tip. */
const PETAL_D = 'M50 52C35 45 26.5 33 28.5 21.5 30.2 12.5 37 7.6 43.6 8.6L50 15.4 56.4 8.6C63 7.6 69.8 12.5 71.5 21.5 73.5 33 65 45 50 52Z';
/** Three pinks, so the overlapping petals read apart (as on icon.png). */
const FILLS = [0, 1, 2, 0, 1];

/**
 * The flower of the logo (public/icon.png without its frame), drawn in parts so it can be animated:
 * `.sf-petal` (×5, `--i` = 0…4), `.sf-mark` (magenta dashes), `.sf-stamen` (paths, pathLength 1)
 * and `.sf-dot`. The animations live with each use (splash screen, player loader) in globals.css.
 */
export function SakuraFlower({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const g = (n: number) => `sf-${id}-g${n}`;
  const delay = (i: number) => ({ '--i': i }) as React.CSSProperties;
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={g(0)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF8FB8" />
          <stop offset="1" stopColor="#FF6B9E" />
        </linearGradient>
        <linearGradient id={g(1)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB3CD" />
          <stop offset="1" stopColor="#FF8DB4" />
        </linearGradient>
        <linearGradient id={g(2)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF6E9F" />
          <stop offset="1" stopColor="#FF4F8A" />
        </linearGradient>
      </defs>
      <g stroke="#C9497C" strokeOpacity="0.55" strokeWidth="0.9" strokeLinejoin="round">
        {ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 50 50) translate(0 -1)`}>
            <path className="sf-petal" style={delay(i)} d={PETAL_D} fill={`url(#${g(FILLS[i])})`} />
          </g>
        ))}
      </g>
      <g fill="#FF2D6F">
        {ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle + 36} 50 50)`}>
            <rect className="sf-mark" style={delay(i)} x="49" y="37" width="2" height="5" rx="1" />
          </g>
        ))}
      </g>
      <g stroke="#E4E4EA" strokeWidth="2.4" strokeLinecap="round">
        {ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 50 50)`}>
            <path className="sf-stamen" style={delay(i)} d="M50 50V31" pathLength={1} />
          </g>
        ))}
      </g>
      <g fill="#D6D6DC">
        {ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 50 50)`}>
            <circle className="sf-dot" style={delay(i)} cx="50" cy="30" r="3.4" />
          </g>
        ))}
      </g>
    </svg>
  );
}
