export interface SkipInterval {
  type: 'op' | 'ed';
  start: number;
  end: number;
}

const cache = new Map<string, Promise<SkipInterval[]>>();

/** Opening / ending timestamps from the community AniSkip database (keyed by MyAnimeList id). */
export function getSkipTimes(malId: number, episode: number): Promise<SkipInterval[]> {
  const key = `${malId}:${episode}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types=op&types=ed&episodeLength=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) =>
        ((data?.found ? data.results : []) as { skipType: 'op' | 'ed'; interval: { startTime: number; endTime: number } }[]).map(
          (r) => ({ type: r.skipType, start: r.interval.startTime, end: r.interval.endTime })
        )
      )
      .catch(() => []);
    cache.set(key, pending);
  }
  return pending;
}
