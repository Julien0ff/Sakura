'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Minimal popover: trigger + panel rendered in a portal with fixed positioning,
 * so overflow-hidden ancestors (hero banners, cards) never clip it.
 * Closes on outside click, Escape, scroll and resize, with a short exit animation.
 */
const EXIT_MS = 140;

export function Popover({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  label,
  className = '',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  side?: 'bottom' | 'top' | 'right';
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Play the exit animation, then unmount.
  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  // Place the panel next to the trigger, flipping / clamping to stay on screen.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const p = panelRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    let top: number;
    let left: number;
    if (side === 'right') {
      left = a.right + gap;
      top = a.bottom - p.height;
    } else {
      const below = a.bottom + gap;
      const above = a.top - gap - p.height;
      const wantTop = side === 'top';
      top = wantTop ? (above >= gap ? above : below) : below + p.height <= vh - gap ? below : above;
      left = align === 'end' ? a.right - p.width : a.left;
    }
    left = Math.min(Math.max(gap, left), vw - p.width - gap);
    top = Math.min(Math.max(gap, top), vh - p.height - gap);
    setStyle({ top, left, visibility: 'visible' });
  }, [open, side, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onMove = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, close]);

  return (
    <div ref={anchorRef} className={`relative ${className}`}>
      {trigger({
        open,
        toggle: () => {
          if (open) return setClosing(true);
          setStyle({ visibility: 'hidden' });
          setOpen(true);
        },
      })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            style={{ position: 'fixed', animationFillMode: 'both', ...style }}
            className={`z-[150] menu-glass rounded-2xl p-1.5 ${
              closing ? 'animate-out fade-out-0 zoom-out-95 duration-150 pointer-events-none' : 'animate-in fade-in-0 zoom-in-95 duration-200'
            }`}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </div>
  );
}
