'use client';

import { useEffect } from 'react';
import { isLiteRendering } from '@/lib/desktop';

/**
 * Fallback for browsers without CSS scroll-driven animations (Firefox for now).
 * Mirrors the keyframes in globals.css by writing transform/opacity directly on
 * [data-sd] elements — compositor-only properties, batched in one rAF per frame.
 */
export function ScrollEffectsFallback() {
  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Desktop app on Linux (WebKitGTK): per-frame style writes on scroll are what makes it lag.
    if (isLiteRendering()) return;
    const scroller = document.getElementById('main-scroll');
    if (!scroller) return;

    let frame = 0;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const y = scroller.scrollTop;
      const p = clamp(y / (0.75 * vh));
      const pc = clamp(y / (0.45 * vh));
      const pa = clamp(y / (0.9 * vh));

      document.querySelectorAll<HTMLElement>('[data-sd]').forEach((el) => {
        switch (el.dataset.sd) {
          case 'parallax':
            el.style.transform = `translate3d(0, ${p * 28}%, 0) scale(${1 + p * 0.08})`;
            break;
          case 'content':
            el.style.opacity = String(1 - pc);
            el.style.transform = `translate3d(0, ${-pc * 40}px, 0)`;
            break;
          case 'media':
            el.style.opacity = String(1 - p * 0.7);
            break;
        }
      });
      const glow = document.querySelector<HTMLElement>('.ambient-glow');
      const wash = document.querySelector<HTMLElement>('.ambient-wash');
      if (glow) glow.style.opacity = String(0.6 - pa * 0.42);
      if (wash) wash.style.opacity = String(0.35 + pa * 0.65);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
