'use client';

import { haptic } from '@/lib/haptics';

/* ───────── Building blocks (iOS-style grouped list) ───────── */

export function Group({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-4 mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">{title}</h2>
      <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.08]">{children}</div>
      {footer && <p className="px-4 mt-2 text-[13px] leading-snug text-[#8E8E93]">{footer}</p>}
    </section>
  );
}

export function Row({
  label,
  hint,
  stackOnMobile = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Put the control under the label on phones (wide controls like segmented pickers). */
  stackOnMobile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 px-4 py-3 min-h-[56px] ${
        stackOnMobile ? 'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4' : 'items-center justify-between gap-4'
      }`}
    >
      <div className="min-w-0">
        <div className="text-[16px] text-white">{label}</div>
        {hint && <div className="text-[13px] leading-snug text-[#8E8E93] mt-0.5">{hint}</div>}
      </div>
      <div className={stackOnMobile ? 'w-full sm:w-auto shrink-0' : 'shrink-0'}>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  silent = false,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  /** Skip the default selection haptic (the caller plays its own). */
  silent?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 p-1 rounded-xl bg-black/40 border border-white/10 w-full sm:w-auto sm:min-w-[240px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => {
            if (!silent) haptic('selection');
            onChange(v);
          }}
          className={`h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            value === v ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  destructive = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 px-4 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive ? 'bg-red-500/15 hover:bg-red-500/25 text-[#FF6961]' : 'bg-white/10 hover:bg-white/20 text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3 min-h-[56px] cursor-pointer active:bg-white/[0.03]">
      <span className="min-w-0">
        <span className="block text-[16px] text-white">{label}</span>
        {hint && <span className="block text-[13px] leading-snug text-[#8E8E93] mt-0.5">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => {
            onChange(e.target.checked);
            haptic('selection');
          }}
        />
        <span className="block w-[51px] h-[31px] rounded-full bg-white/15 peer-checked:bg-[#30D158] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
        <span className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
