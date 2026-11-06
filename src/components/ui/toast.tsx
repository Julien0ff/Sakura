'use client';

import { create } from 'zustand';

type Toast = { id: number; text: string };
const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let nextId = 1;

/** Short confirmation at the top of the screen (4 s). */
export function toast(text: string) {
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items, { id, text }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4000);
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div aria-live="polite" className="fixed z-[200] top-[max(env(safe-area-inset-top),16px)] inset-x-0 flex flex-col items-center gap-2 pointer-events-none px-4">
      {items.map((t) => (
        <div key={t.id} role="status" className="tab-bar-glass rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-top-2">
          {t.text}
        </div>
      ))}
    </div>
  );
}
