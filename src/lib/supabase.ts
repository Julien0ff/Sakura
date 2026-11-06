import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Same value on server and client (env is inlined at build): safe for rendering decisions. */
export const accountsEnabled = !!(url && key);

/**
 * Browser-only Supabase client (PKCE, session in localStorage).
 * `null` when the env vars are missing or on the server: the site then runs without accounts.
 */
export const supabase: SupabaseClient<Database> | null =
  url && key && typeof window !== 'undefined'
    ? createClient<Database>(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
