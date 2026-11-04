'use client';

import { useEffect } from 'react';
import { readableOn } from './color';

/**
 * Pushes an anime's dominant color to <html> as --anime-color so the ambient wash,
 * the sidebar indicator and accents follow it. Fades the wash out on unmount.
 */
export function useAmbientColor(color: string | null | undefined, strength = 1) {
  useEffect(() => {
    if (!color) return;
    const root = document.documentElement;
    root.style.setProperty('--anime-color', color);
    // Foreground for anything filled with the anime color (sidebar active item…).
    root.style.setProperty('--anime-on', readableOn(color));
    root.style.setProperty('--ambient-strength', String(strength));
  }, [color, strength]);

  useEffect(() => {
    const root = document.documentElement;
    return () => {
      root.style.setProperty('--ambient-strength', '0');
    };
  }, []);
}
