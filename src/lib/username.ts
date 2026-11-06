/** Username rules — must match the `username_format` check in supabase/migrations. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const RESERVED_USERNAMES: readonly string[] = [
  'settings', 'api', 'auth', 'anime', 'profile', 'profiles', 'discover', 'search', 'history', 'watchlist',
  'calendar', 'legal', 'onboarding', 'u', 'user', 'users', 'admin', 'sakura', 'login', 'logout', 'me', 'help', 'about',
];

/** Lowercase, accents folded, spaces/dashes → `_`, other characters dropped, max 20. */
export function normalizeUsername(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
}

/** Best guess from the provider metadata (Discord `user_name`, Google `full_name`, then email). */
export function suggestUsername(meta: Record<string, unknown>): string {
  const pick = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '');
  const raw = pick('user_name') || pick('preferred_username') || pick('full_name') || pick('name') || pick('email').split('@')[0];
  const name = normalizeUsername(raw);
  if (!name) return '';
  return name.length < 3 ? `${name}_sakura` : name;
}

/** French message for a client-side problem, or null when the format is valid. */
export function usernameProblem(name: string): string | null {
  if (name.length < 3) return 'Au moins 3 caractères.';
  if (name.length > 20) return '20 caractères maximum.';
  if (!USERNAME_RE.test(name)) return 'Lettres minuscules, chiffres et _ uniquement.';
  if (RESERVED_USERNAMES.includes(name)) return 'Ce pseudo est réservé.';
  return null;
}
