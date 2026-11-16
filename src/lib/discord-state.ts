import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_STATE_PATH = path.join(DATA_DIR, 'discord-state.json');
const TMP_STATE_PATH = path.join(os.tmpdir(), 'sakura-discord-state.json');

export interface DiscordState {
  lastMessages: Record<string, string>;
  updatedAt?: string;
}

const DEFAULT_STATE: DiscordState = {
  lastMessages: {},
};

export async function readDiscordState(): Promise<DiscordState> {
  // 1. Try local data dir
  try {
    const raw = await fs.readFile(LOCAL_STATE_PATH, 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    // 2. Try tmp state (Vercel serverless)
    try {
      const raw = await fs.readFile(TMP_STATE_PATH, 'utf-8');
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_STATE;
    }
  }
}

export async function saveDiscordState(state: DiscordState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  // 1. Save to tmpdir (always writable)
  try {
    await fs.writeFile(TMP_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[discord-state] Could not write to tmp:', err);
  }
  // 2. Save to local data dir (if possible)
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LOCAL_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Read-only serverless environment, normal
  }
}

export async function getLastMessageId(key: string): Promise<string | null> {
  const state = await readDiscordState();
  return state.lastMessages[key] || null;
}

export async function setLastMessageId(key: string, id: string): Promise<void> {
  const state = await readDiscordState();
  state.lastMessages[key] = id;
  await saveDiscordState(state);
}

/**
 * Deletes a previously posted message by webhook URL and message snowflake ID.
 * Returns true if deleted or already gone (404), false on network error.
 */
export async function deleteWebhookMessage(webhookUrl: string, messageId: string): Promise<boolean> {
  if (!webhookUrl || !messageId) return false;
  try {
    const cleanUrl = webhookUrl.split('?')[0].replace(/\/messages\/?.*$/, '');
    const deleteUrl = `${cleanUrl}/messages/${messageId}`;
    const res = await fetch(deleteUrl, { method: 'DELETE' });
    if (res.status === 204 || res.status === 404) {
      return true;
    }
    console.warn(`[discord-state] Discord DELETE message ${messageId} returned ${res.status}`);
    return false;
  } catch (err) {
    console.warn(`[discord-state] Error deleting webhook message ${messageId}:`, err);
    return false;
  }
}
