/** WCAG relative luminance of a #rgb / #rrggbb color (0 = black, 1 = white). */
export function luminance(hex: string) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Text color to put on a background of `hex`: whichever of black or white has the
 * higher WCAG contrast ratio. Light AniList colors (cream, pastel…) get black text.
 */
export function readableOn(hex: string | null | undefined) {
  if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return '#FFFFFF';
  const L = luminance(hex);
  const withWhite = 1.05 / (L + 0.05);
  const withBlack = (L + 0.05) / 0.05;
  return withBlack > withWhite ? '#000000' : '#FFFFFF';
}
