/** Which finished anime award a trophy (on top of unlocking their banner). */
export const TROPHY_POPULARITY = 150_000;

/** Manual overrides by AniList id: force a trophy (include) or never give one (exclude). */
export const TROPHY_OVERRIDES = { include: [] as number[], exclude: [] as number[] };

export function isTrophy(id: number, popularity?: number | null): boolean {
  if (TROPHY_OVERRIDES.exclude.includes(id)) return false;
  if (TROPHY_OVERRIDES.include.includes(id)) return true;
  return (popularity ?? 0) >= TROPHY_POPULARITY;
}
