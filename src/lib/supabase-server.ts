import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import type { PublicProfile } from './public-profile';
import { USERNAME_RE } from './username';

/**
 * Anonymous read of a profile through the filtered RPC (visitors' view: private → null).
 * `cache` dedupes the call between generateMetadata and the page.
 */
export const getPublicProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !USERNAME_RE.test(username)) return null;
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('get_public_profile', { name: username });
  if (error) throw error;
  return (data as unknown as PublicProfile | null) ?? null;
});
