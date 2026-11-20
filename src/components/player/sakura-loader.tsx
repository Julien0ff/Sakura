/* eslint-disable @next/next/no-img-element -- remote posters (AniList / TMDB) */
import { SakuraFlower } from '@/components/ui/sakura-flower';

/**
 * The player's loading screen: the logo's flower blooms, then breathes petal by petal while the
 * episode loads, over the anime's blurred artwork. Also used as the short intro when the player opens.
 */
export function SakuraLoader({
  title,
  subtitle,
  message,
  poster,
  color,
  leaving = false,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  /** « Recherche de la vidéo », « Chargement du lecteur »… (animated dots are added). */
  message?: string;
  poster?: string | null;
  /** Anime color, tints the glow. */
  color?: string | null;
  /** Fades out (the episode is ready). */
  leaving?: boolean;
  /** Smaller, without the title: over a player that's still loading. */
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message ?? 'Chargement'}
      className={`sakura-loader ${compact ? 'sakura-loader-compact' : ''} ${leaving ? 'sakura-loader-leaving' : ''}`}
      style={{ '--loader-color': color || '#FF7AA8' } as React.CSSProperties}
    >
      {poster && !compact && <img src={poster} alt="" className="sakura-loader-art" />}
      <div className="sakura-loader-glow" aria-hidden />
      <div className="sakura-loader-body">
        <div className="sakura-loader-flower-wrap">
          <span className="sakura-loader-orbit" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <SakuraFlower className="sakura-loader-flower" />
        </div>
        {!compact && title && <div className="sakura-loader-title">{title}</div>}
        {!compact && subtitle && <div className="sakura-loader-subtitle">{subtitle}</div>}
        {message && (
          <div className="sakura-loader-message">
            {message}
            <span className="sakura-loader-dots" aria-hidden>
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          </div>
        )}
        <div className="sakura-loader-bar" aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}
