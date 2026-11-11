'use client';

import { useState, useEffect } from 'react';

/** Memory cache for extracted colors across the session. */
const memoryCache = new Map<string, string>();

/** RGB to HSL conversion (H: 0-360, S: 0-1, L: 0-1). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

/** Convert RGB values to hex string `#RRGGBB`. */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts a vibrant accent color from an image URL using an offscreen canvas.
 * Prioritizes high saturation and readable lightness (avoiding muddy blacks and washed-out whites).
 */
export async function extractAccentColor(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  if (typeof window === 'undefined') return null;

  // Check in-memory cache
  if (memoryCache.has(imageUrl)) {
    return memoryCache.get(imageUrl)!;
  }

  // Check persistent storage
  const storageKey = `sakura:color:${imageUrl}`;
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached && /^#[0-9a-f]{6}$/i.test(cached)) {
      memoryCache.set(imageUrl, cached);
      return cached;
    }
  } catch {}

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanUp = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanUp();
      try {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Group pixels into 18 hue bins (20 deg each)
        const BINS = 18;
        const bins: { r: number; g: number; b: number; count: number; score: number }[] = Array.from(
          { length: BINS },
          () => ({ r: 0, g: 0, b: 0, count: 0, score: 0 })
        );

        let maxScore = -1;
        let bestBinIndex = -1;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue; // Skip transparent

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const [h, s, l] = rgbToHsl(r, g, b);

          // Discard pure blacks, pure whites, and muddy grays
          if (l < 0.12 || l > 0.88 || s < 0.20) continue;

          const binIndex = Math.floor(h / (360 / BINS)) % BINS;
          const bin = bins[binIndex];

          bin.r += r;
          bin.g += g;
          bin.b += b;
          bin.count++;

          // Score: heavily favor saturated colors around 40-60% lightness (vibrant hero colors)
          const lightnessWeight = 1 - Math.abs(l - 0.5) * 1.5;
          const saturationWeight = s * s;
          bin.score += lightnessWeight * saturationWeight;

          if (bin.score > maxScore) {
            maxScore = bin.score;
            bestBinIndex = binIndex;
          }
        }

        if (bestBinIndex >= 0 && bins[bestBinIndex].count > 0) {
          const b = bins[bestBinIndex];
          const hex = rgbToHex(b.r / b.count, b.g / b.count, b.b / b.count);
          memoryCache.set(imageUrl, hex);
          try {
            localStorage.setItem(storageKey, hex);
          } catch {}
          resolve(hex);
        } else {
          // Fallback: pick average color of central pixels
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      cleanUp();
      resolve(null);
    };

    // Use smaller TMDB thumbnail if it's a TMDB image to accelerate download & decode
    let src = imageUrl;
    if (src.includes('image.tmdb.org/t/p/')) {
      src = src.replace(/\/t\/p\/(original|w500|w342)\//, '/t/p/w92/');
    }
    img.src = src;
  });
}

/**
 * Hook to retrieve an anime's or cartoon's accent color.
 * If `initialColor` is provided (e.g. from AniList), returns it immediately.
 * Otherwise, extracts the vibrant dominant color from `imageUrl` asynchronously.
 */
export function useExtractedColor(imageUrl?: string | null, initialColor?: string | null): string | null {
  const [color, setColor] = useState<string | null>(() => {
    if (initialColor) return initialColor;
    if (!imageUrl) return null;
    return memoryCache.get(imageUrl) || (typeof window !== 'undefined' ? localStorage.getItem(`sakura:color:${imageUrl}`) : null);
  });

  useEffect(() => {
    if (initialColor) {
      setColor(initialColor);
      return;
    }
    if (!imageUrl) return;

    let stale = false;
    extractAccentColor(imageUrl).then((extracted) => {
      if (!stale && extracted) setColor(extracted);
    });

    return () => {
      stale = true;
    };
  }, [imageUrl, initialColor]);

  return color;
}

