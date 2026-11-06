/**
 * Last-write-wins merge between the local store and Supabase, one logical row at a time.
 * Kept free of `@/` imports so `node --test` can load it directly.
 */
export type Row<T> = {
  key: string;
  /** `null` = deleted (tombstone). */
  value: T | null;
  /** Epoch ms. */
  updatedAt: number;
};

/**
 * Newest `updatedAt` wins; on a tie the remote copy wins (the server is the shared truth).
 * `toPush` = rows where the local copy strictly won, or that the server doesn't have yet.
 */
export function mergeRows<T>(local: Row<T>[], remote: Row<T>[]): { merged: Row<T>[]; toPush: Row<T>[] } {
  const remoteByKey = new Map(remote.map((r) => [r.key, r]));
  const merged: Row<T>[] = [];
  const toPush: Row<T>[] = [];
  const seen = new Set<string>();

  for (const l of local) {
    seen.add(l.key);
    const r = remoteByKey.get(l.key);
    if (!r || l.updatedAt > r.updatedAt) {
      merged.push(l);
      toPush.push(l);
    } else {
      merged.push(r);
    }
  }
  for (const r of remote) if (!seen.has(r.key)) merged.push(r);

  return { merged, toPush };
}
