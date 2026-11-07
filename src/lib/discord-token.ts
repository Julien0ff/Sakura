/**
 * Mobile Discord status (M4): the app links the user's Discord account through the Social SDK
 * (OAuth2 + PKCE); the code — and later the refresh token — is exchanged here, on the server,
 * with the Discord app's secret. Pure module (no imports) so `node --test` can load it.
 */

/** Discord application « SAKURA » (same as the PC status). */
export const DISCORD_APP_ID = '1568341036894523432';
/** Redirect the Social SDK uses on Android / iOS (declared in the developer portal). */
export const MOBILE_REDIRECT_URI = `discord-${DISCORD_APP_ID}:/authorize/callback`;

export type TokenRequest = { kind: 'code'; code: string; codeVerifier: string } | { kind: 'refresh'; refreshToken: string };

const MAX = 512;
const isText = (v: unknown, min = 1): v is string => typeof v === 'string' && v.length >= min && v.length <= MAX;

/** Request body from the app → a code exchange or a refresh; null when invalid. */
export function parseTokenRequest(body: unknown): TokenRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if ('refreshToken' in b) return isText(b.refreshToken) ? { kind: 'refresh', refreshToken: b.refreshToken } : null;
  // RFC 7636: verifiers are 43–128 characters.
  if (!isText(b.code) || !isText(b.codeVerifier, 43) || b.codeVerifier.length > 128 || b.redirectUri !== MOBILE_REDIRECT_URI) return null;
  return { kind: 'code', code: b.code, codeVerifier: b.codeVerifier };
}

/** Form for POST https://discord.com/api/v10/oauth2/token. */
export function tokenForm(req: TokenRequest, clientSecret: string): string {
  const grant: Record<string, string> =
    req.kind === 'code'
      ? { grant_type: 'authorization_code', code: req.code, code_verifier: req.codeVerifier, redirect_uri: MOBILE_REDIRECT_URI }
      : { grant_type: 'refresh_token', refresh_token: req.refreshToken };
  return new URLSearchParams({ ...grant, client_id: DISCORD_APP_ID, client_secret: clientSecret }).toString();
}

export interface AppTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Discord's token answer → what the app reads (`src-tauri/src/discord_mobile.rs`). */
export function readTokens(json: unknown): AppTokens | null {
  const j = json as Record<string, unknown> | null;
  if (!j || typeof j.access_token !== 'string' || typeof j.refresh_token !== 'string' || typeof j.expires_in !== 'number') return null;
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in };
}
