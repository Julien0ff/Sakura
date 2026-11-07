'use client';

import { create } from 'zustand';

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; text: string; action?: ToastAction };
const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let nextId = 1;

const dismiss = (id: number) => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));

/** Short message at the top of the screen (4 s; 12 s when it carries an action button). */
export function toast(text: string, opts: { action?: ToastAction } = {}) {
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items, { id, text, action: opts.action }] }));
  setTimeout(() => dismiss(id), opts.action ? 12000 : 4000);
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div aria-live="polite" className="fixed z-[200] top-[max(env(safe-area-inset-top),16px)] inset-x-0 flex flex-col items-center gap-2 pointer-events-none px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`tab-bar-glass rounded-full text-[14px] font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-top-2 flex items-center gap-3 ${
            t.action ? 'pl-5 pr-1.5 py-1.5 pointer-events-auto' : 'px-5 py-2.5'
          }`}
        >
          {t.text}
          {t.action && (
            <button
              type="button"
              onClick={() => {
                dismiss(t.id);
                t.action!.onClick();
              }}
              className="h-8 px-4 rounded-full bg-white text-black text-[13px] font-bold cursor-pointer"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
