'use client';

import { haptic } from '@/lib/haptics';

/** 1–10 pills. Clicking the current value clears it. */
export function RatingPicker({
  value,
  onChange,
  label,
  size = 'md',
}: {
  value: number | null | undefined;
  onChange: (rating: number | null) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[12px]' : 'w-8 h-8 md:w-9 md:h-9 text-[13px]';
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sur 10`}
            onClick={(e) => {
              e.stopPropagation();
              haptic('selection');
              onChange(value === n ? null : n);
            }}
            className={`${dim} rounded-full font-bold tabular-nums transition-colors cursor-pointer ${
              on ? 'bg-[#FFD60A] text-black' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
