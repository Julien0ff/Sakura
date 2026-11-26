'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from '@/components/ui/icons';
import { haptic } from '@/lib/haptics';

/**
 * Horizontal card row that runs to the screen edges (cards stay aligned with the title at rest
 * thanks to scroll-padding). On desktop, cards scrolling under the floating sidebar get blurred.
 * A mouse wheel can't scroll it sideways, so desktop gets arrows on hover (touch and trackpads
 * keep the native swipe).
 */
export function RowScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [measure, children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    haptic('light');
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.75, 200), behavior: 'smooth' });
  };

  const arrow =
    'absolute top-2 bottom-6 z-10 hidden md:flex items-center opacity-0 group-hover/row:opacity-100 has-[:focus-visible]:opacity-100 transition-opacity duration-200';
  const button =
    'flex items-center justify-center w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-lg hover:bg-black/80 hover:scale-105 active:scale-95 transition cursor-pointer';

  return (
    <div className="relative group/row">
      <div
        ref={ref}
        onScroll={measure}
        className="flex gap-4 overflow-x-auto pb-6 pt-2 px-6 md:pl-32 md:pr-10 scroll-px-6 md:scroll-pl-32 md:scroll-pr-10 snap-x snap-mandatory scrollbar-none"
      >
        {children}
      </div>
      <div aria-hidden className="row-edge-blur hidden md:block" />
      {!edges.start && (
        <div className={`${arrow} left-[136px]`}>
          <button type="button" onClick={() => page(-1)} aria-label="Défiler vers la gauche" className={button}>
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        </div>
      )}
      {!edges.end && (
        <div className={`${arrow} right-4`}>
          <button type="button" onClick={() => page(1)} aria-label="Défiler vers la droite" className={button}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
