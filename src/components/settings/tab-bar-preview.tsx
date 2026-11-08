'use client';

import { Home, Compass, Search, Bookmark, Clock } from '@/components/ui/icons';
import { haptic } from '@/lib/haptics';

const TABS = [
  { name: 'Accueil', icon: Home },
  { name: 'Découvrir', icon: Compass },
  { name: 'Recherche', icon: Search },
  { name: 'Ma Liste', icon: Bookmark },
  { name: 'Historique', icon: Clock },
];

/** Miniature of the phone tab bar over sample artwork, for the Settings › Apparence choices. */
export function TabBarPreview({ labels, liquid }: { labels: boolean; liquid: boolean }) {
  return (
    <div aria-hidden className="tab-preview relative h-[96px] overflow-hidden rounded-xl">
      <div className={`tab-preview-bar ${liquid ? 'liquid' : ''} absolute left-2 right-2 bottom-2 flex items-stretch gap-0.5 p-1 rounded-[18px]`}>
        {TABS.map(({ name, icon: Icon }, i) => (
          <span
            key={name}
            className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-[14px] ${labels ? 'h-[38px]' : 'h-[30px]'} ${
              i === 0 ? (liquid ? 'bg-white/[0.14] text-[#FF7AA8]' : 'bg-white/[0.16] text-white') : 'text-[#A1A1A6]'
            }`}
          >
            <Icon className="w-[15px] h-[15px]" />
            {/* Too small to read: a line stands for the name. */}
            {labels && <span className="block h-[3px] w-[55%] rounded-full bg-current opacity-70" />}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Two visual choices side by side (radio group): a preview each, the name under it. */
export function PreviewChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; name: string; preview: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) haptic('selection');
              onChange(o.value);
            }}
            className={`rounded-2xl p-1.5 text-left transition-colors border ${
              selected ? 'border-[#FF7AA8] bg-[#FF7AA8]/[0.08]' : 'border-white/[0.08] bg-white/[0.03] active:bg-white/[0.06]'
            }`}
          >
            {o.preview}
            <span className="flex items-center gap-2 px-1.5 pt-2 pb-1 text-[14px] font-medium text-white">
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-[#FF7AA8]' : 'border-white/30'}`}
              >
                {selected && <span className="w-2 h-2 rounded-full bg-[#FF7AA8]" />}
              </span>
              {o.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
