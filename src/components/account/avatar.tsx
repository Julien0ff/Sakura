/* eslint-disable @next/next/no-img-element -- remote avatars from arbitrary hosts, images are unoptimized anyway */
import { User } from '@/components/ui/icons';

/** Round avatar with a neutral fallback. */
export function Avatar({ src, alt = '', size = 40, className = '' }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return src ? (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={`rounded-full object-cover bg-white/10 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden={!alt}
      aria-label={alt || undefined}
      className={`rounded-full bg-white/10 text-white/70 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <User style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
