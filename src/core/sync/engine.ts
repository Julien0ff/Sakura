'use client';

/**
 * Bidirectional sync between the persisted zustand store and Supabase.
 * - Start: full pull → last-write-wins merge → replace the store → push what local won.
 * - Then: store changes are diffed into a dirty set and flushed (2 s; progress-only 15 s; at once when hidden).
 * - Foreground / back online: incremental pull on the server-side `synced_at` cursor.
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/core/auth';
import type { Json } from '@/lib/database.types';
import { useAppStore, type Settings, type SyncSnapshot } from '@/core/store';
import { mergeRows, type Row } from './merge';
import {
  episodeRatingFromDb,
  episodeRatingToDb,
  historyFromDb,
  historyToDb,
  localRows,
  progressFromDb,
  progressRowKey,
  progressToDb,
  snapshotFromRows,
  watchlistFromDb,
  watchlistToDb,
  type SyncRows,
} from './mappers';

const FLUSH_MS = 2000;
const PROGRESS_FLUSH_MS = 15000;
const PAGE = 1000;
const SETTINGS_KEY = 's';

type Table = 'watchlist_entries' | 'history_entries' | 'episode_progress' | 'episode_ratings';

let session: {
  uid: string;
  dirty: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  timerDue: number;
  flushing: Promise<void> | null;
  applyingRemote: boolean;
  stopped: boolean;
  /** False until the first full pull succeeded (offline start → retried on foreground / online). */
  pulledOnce: boolean;
} | null = null;

const cursorKey = (uid: string) => `sakura-sync:${uid}`;

function snapshot(): SyncSnapshot {
  const s = useAppStore.getState();
  return {
    watchlist: s.watchlist,
    history: s.history,
    progress: s.progress,
    episodeRatings: s.episodeRatings,
    deleted: s.deleted,
    settings: s.settings,
    settingsUpdatedAt: s.settingsUpdatedAt,
  };
}

async function fetchAll(table: Table, uid: string, since?: string) {
  if (!supabase) return [];
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('*').eq('user_id', uid).order('synced_at').range(from, from + PAGE - 1);
    if (since) q = q.gt('synced_at', since);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function maxCursor(prev: string | null, rows: Record<string, unknown>[]) {
  let max = prev;
  for (const r of rows) {
    const at = r.synced_at as string;
    if (!max || Date.parse(at) > Date.parse(max)) max = at;
  }
  return max;
}

/** Pull (all, or since the cursor), merge into the store, push what local won. */
async function pull(full: boolean) {
  if (!supabase || !session) return;
  const { uid } = session;
  const since = full ? undefined : localStorage.getItem(cursorKey(uid)) ?? undefined;

  const [w, h, p, er, profile] = await Promise.all([
    fetchAll('watchlist_entries', uid, since),
    fetchAll('history_entries', uid, since),
    fetchAll('episode_progress', uid, since),
    fetchAll('episode_ratings', uid, since),
    supabase.from('profiles').select('settings').eq('id', uid).maybeSingle(),
  ]);
  if (!session || session.uid !== uid || session.stopped) return;
  if (full) session.pulledOnce = true;

  const remote: SyncRows = {
    watchlist: w.map((d) => watchlistFromDb(d as never)),
    history: h.map((d) => historyFromDb(d as never)),
    progress: p.map((d) => progressFromDb(d as never)),
    episodeRatings: er.map((d) => episodeRatingFromDb(d as never)),
  };
  const local = localRows(snapshot());

  // Incremental pulls only bring changed rows: merge them over the full local set.
  const mergeTable = <T,>(l: Row<T>[], r: Row<T>[]) => {
    const { merged, toPush } = mergeRows(l, r);
    return { merged, toPush: full ? toPush : [] };
  };
  const mw = mergeTable(local.watchlist, remote.watchlist);
  const mh = mergeTable(local.history, remote.history);
  const mp = mergeTable(local.progress, remote.progress);
  const mr = mergeTable(local.episodeRatings, remote.episodeRatings);

  const remoteSettings = (profile.data?.settings ?? {}) as Partial<Settings> & { __updatedAt?: number };
  const remoteSettingsAt = remoteSettings.__updatedAt ?? 0;
  const s = useAppStore.getState();
  const settingsRemoteWins = remoteSettingsAt > s.settingsUpdatedAt;
  const { __updatedAt: _ignored, ...remoteSettingsValues } = remoteSettings;
  void _ignored;

  const next = snapshotFromRows(
    { watchlist: mw.merged, history: mh.merged, progress: mp.merged, episodeRatings: mr.merged },
    settingsRemoteWins ? { ...s.settings, ...remoteSettingsValues } : s.settings,
    settingsRemoteWins ? remoteSettingsAt : s.settingsUpdatedAt
  );
  session.applyingRemote = true;
  try {
    useAppStore.getState().replaceAll(next);
  } finally {
    session.applyingRemote = false;
  }

  for (const r of [...mw.toPush, ...mh.toPush, ...mp.toPush, ...mr.toPush]) session.dirty.add(r.key);
  if (full && s.settingsUpdatedAt > remoteSettingsAt) session.dirty.add(SETTINGS_KEY);

  const cursor = maxCursor(since ?? null, [...w, ...h, ...p, ...er]);
  if (cursor) localStorage.setItem(cursorKey(uid), cursor);
  if (session.dirty.size) schedule(0);
}

/** Write every dirty key's current local state to Supabase. Failed keys go back to the queue. */
async function flush() {
  if (!supabase || !session || session.dirty.size === 0) return;
  if (session.flushing) return session.flushing;
  const keys = [...session.dirty];
  session.dirty.clear();
  const rows = localRows(snapshot());
  const byKey = new Map<string, Row<unknown>>(
    [...rows.watchlist, ...rows.history, ...rows.progress, ...rows.episodeRatings].map((r) => [r.key, r as Row<unknown>])
  );

  const watch = [];
  const hist = [];
  const prog = [];
  const rates = [];
  let settings = false;
  for (const k of keys) {
    if (k === SETTINGS_KEY) settings = true;
    const r = byKey.get(k);
    if (!r) continue; // e.g. progress trimmed locally: nothing to send
    if (k.startsWith('w:')) watch.push(watchlistToDb(r as never));
    else if (k.startsWith('h:')) hist.push(historyToDb(r as never));
    else if (k.startsWith('r:')) rates.push(episodeRatingToDb(r as never));
    else if (k.startsWith('p:')) {
      const d = progressToDb(r as never);
      if (d) prog.push(d);
    }
  }

  const client = supabase;
  const s = session;
  s.flushing = (async () => {
    const results = await Promise.all([
      watch.length ? client.from('watchlist_entries').upsert(watch, { onConflict: 'user_id,anime_id' }) : null,
      hist.length ? client.from('history_entries').upsert(hist, { onConflict: 'user_id,anime_id' }) : null,
      prog.length ? client.from('episode_progress').upsert(prog, { onConflict: 'user_id,anime_id,season,episode' }) : null,
      rates.length ? client.from('episode_ratings').upsert(rates, { onConflict: 'user_id,anime_id,season,episode' }) : null,
      settings
        ? client
            .from('profiles')
            .update({ settings: { ...snapshot().settings, __updatedAt: snapshot().settingsUpdatedAt } as unknown as Json })
            .eq('id', s.uid)
        : null,
    ]);
    const failed = [
      results[0]?.error ? keys.filter((k) => k.startsWith('w:')) : [],
      results[1]?.error ? keys.filter((k) => k.startsWith('h:')) : [],
      results[2]?.error ? keys.filter((k) => k.startsWith('p:')) : [],
      results[3]?.error ? keys.filter((k) => k.startsWith('r:')) : [],
      results[4]?.error ? [SETTINGS_KEY] : [],
    ].flat();
    if (failed.length && !s.stopped) {
      failed.forEach((k) => s.dirty.add(k));
      console.warn('[sync] push failed, will retry', results.find((r) => r?.error)?.error?.message);
    }
  })()
    .catch((e) => {
      if (!s.stopped) keys.forEach((k) => s.dirty.add(k));
      console.warn('[sync] push failed, will retry', e);
    })
    .finally(() => {
      s.flushing = null;
      // Changes made while this flush was in flight.
      if (!s.stopped && s.dirty.size) schedule(FLUSH_MS);
    });
  return s.flushing;
}

function schedule(delay: number) {
  if (!session) return;
  const due = Date.now() + delay;
  // Keep an earlier deadline if one is already set.
  if (session.timer && session.timerDue <= due) return;
  if (session.timer) clearTimeout(session.timer);
  session.timerDue = due;
  session.timer = setTimeout(() => {
    if (!session) return;
    session.timer = null;
    void flush();
  }, delay);
}

/** Diff two store states into sync keys. */
function changedKeys(prev: SyncSnapshot, next: SyncSnapshot) {
  const keys: string[] = [];
  if (prev.watchlist !== next.watchlist || prev.deleted !== next.deleted) {
    const before = new Map(prev.watchlist.map((a) => [a.id, a.updatedAt]));
    for (const a of next.watchlist) if (before.get(a.id) !== a.updatedAt) keys.push(`w:${a.id}`);
  }
  if (prev.history !== next.history) {
    const before = new Map(prev.history.map((h) => [h.id, h.watchedAt]));
    for (const h of next.history) if (before.get(h.id) !== h.watchedAt) keys.push(`h:${h.id}`);
  }
  if (prev.deleted !== next.deleted) {
    for (const [k, at] of Object.entries(next.deleted)) if (prev.deleted[k] !== at) keys.push(k);
  }
  if (prev.episodeRatings !== next.episodeRatings) {
    for (const [k, r] of Object.entries(next.episodeRatings)) if (prev.episodeRatings[k]?.updatedAt !== r.updatedAt) keys.push(`r:${k}`);
  }
  let progressOnly = keys.length === 0;
  if (prev.progress !== next.progress) {
    for (const [k, p] of Object.entries(next.progress)) if (prev.progress[k]?.updatedAt !== p.updatedAt) keys.push(progressRowKey(k));
  }
  if (prev.settingsUpdatedAt !== next.settingsUpdatedAt) {
    keys.push(SETTINGS_KEY);
    progressOnly = false;
  }
  return { keys, progressOnly };
}

function whenHydrated() {
  return new Promise<void>((resolve) => {
    if (useAppStore.persist.hasHydrated()) resolve();
    else {
      const off = useAppStore.persist.onFinishHydration(() => {
        off();
        resolve();
      });
    }
  });
}

/** Start syncing for `uid`. Returns a stop function. */
export function startSync(uid: string): () => void {
  stopSync();
  if (!supabase) return () => {};
  const s: NonNullable<typeof session> = { uid, dirty: new Set(), timer: null, timerDue: 0, flushing: null, applyingRemote: false, stopped: false, pulledOnce: false };
  session = s;
  const pullNow = () => pull(!s.pulledOnce).catch((e) => console.warn('[sync] pull failed', e));

  const unsubscribe = useAppStore.subscribe((next, prev) => {
    if (s.stopped || s.applyingRemote) return;
    const { keys, progressOnly } = changedKeys(prev, next);
    if (!keys.length) return;
    keys.forEach((k) => s.dirty.add(k));
    schedule(progressOnly ? PROGRESS_FLUSH_MS : FLUSH_MS);
  });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush();
    else void pullNow();
  };
  const onOnline = () => {
    void flush();
    void pullNow();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);

  void whenHydrated().then(() => (s.stopped ? undefined : pullNow()));

  return () => {
    s.stopped = true;
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
    if (s.timer) clearTimeout(s.timer);
    if (session === s) session = null;
  };
}

let stopCurrent: (() => void) | null = null;

function stopSync() {
  stopCurrent?.();
  stopCurrent = null;
}

/** Push pending changes now (e.g. before signing out). */
export async function flushNow() {
  await flush();
}

export function runSync(uid: string | null) {
  stopSync();
  if (uid) stopCurrent = startSync(uid);
}

/**
 * Mounted once in <Providers>. Session appears → sync; user signs out → stop and wipe the
 * account's data from this device (anonymous local data is never wiped: we only clear on a
 * transition from a signed-in user to none).
 */
export function SyncBootstrap() {
  useEffect(
    () =>
      useAuthStore.subscribe((next, prev) => {
        const uid = next.session?.user.id ?? null;
        const before = prev.session?.user.id ?? null;
        if (uid === before) return;
        runSync(uid);
        if (before && !uid) useAppStore.getState().clearAccountData();
      }),
    []
  );
  useEffect(() => {
    // Session restored before this effect subscribed.
    const uid = useAuthStore.getState().session?.user.id;
    if (uid) runSync(uid);
    return () => runSync(null);
  }, []);
  return null;
}
