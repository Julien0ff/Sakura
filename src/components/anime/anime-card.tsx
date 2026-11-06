import Link from 'next/link';
import { Play } from '@/components/ui/icons';
import { formatScore, statusLabel } from '@/lib/anime';

interface AnimeCardProps {
  id: number;
  title: string;
  cover: string;
  status?: string | null;
  score?: number | null;
  subtitle?: string;
  /** Small label on the cover (e.g. the user's list status). */
  badge?: string;
  className?: string;
}

export function AnimeCard({ id, title, cover, status, score, subtitle, badge, className = '' }: AnimeCardProps) {
  const rating = formatScore(score);

  return (
    <Link href={`/anime?id=${id}`} className={`flex flex-col gap-3 cursor-pointer group ${className}`}>
      <div className="relative w-full aspect-[2/3] apple-squircle overflow-hidden border border-white/[0.05] bg-white/[0.03] shadow-md transition-all duration-400 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-primary/20">
        {cover && (
          <img
            src={cover}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        )}
        {badge && (
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-md text-[11px] font-semibold text-white">{badge}</span>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full liquid-glass flex items-center justify-center pl-1 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300 ease-out">
            <Play className="w-6 h-6 text-white" fill="currentColor" />
          </div>
        </div>
      </div>

      <div className="px-1">
        <h3 className="text-[#F2F2F7] font-semibold line-clamp-1 text-[15px] tracking-tight">{title}</h3>
        <div className="flex items-center gap-2 mt-0.5 text-[13px] text-[#8E8E93] font-medium">
          {subtitle ? (
            <span className="line-clamp-1">{subtitle}</span>
          ) : (
            <>
              <span>{statusLabel(status)}</span>
              {rating && (
                <>
                  <span>•</span>
                  <span className="text-primary">★ {rating}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-[2/3] bg-white/[0.03] apple-squircle animate-pulse" />
      ))}
    </div>
  );
}

export const animeGridClass = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6';
