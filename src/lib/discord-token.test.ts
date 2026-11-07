import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCORD_APP_ID, MOBILE_REDIRECT_URI, parseTokenRequest, tokenForm, readTokens } from './discord-token.ts';

test('the mobile redirect URI is the one the Social SDK uses', () => {
  assert.equal(MOBILE_REDIRECT_URI, `discord-${DISCORD_APP_ID}:/authorize/callback`);
});

test('parseTokenRequest: authorization code with its PKCE verifier', () => {
  assert.deepEqual(parseTokenRequest({ code: 'abc', codeVerifier: 'v'.repeat(43), redirectUri: MOBILE_REDIRECT_URI }), {
    kind: 'code',
    code: 'abc',
    codeVerifier: 'v'.repeat(43),
  });
});

test('parseTokenRequest: refresh token', () => {
  assert.deepEqual(parseTokenRequest({ refreshToken: 'r1' }), { kind: 'refresh', refreshToken: 'r1' });
});

test('parseTokenRequest rejects other redirects, missing verifiers and junk', () => {
  assert.equal(parseTokenRequest({ code: 'abc', codeVerifier: 'v'.repeat(43), redirectUri: 'https://evil.example/cb' }), null);
  assert.equal(parseTokenRequest({ code: 'abc', redirectUri: MOBILE_REDIRECT_URI }), null);
  assert.equal(parseTokenRequest({ code: 'x'.repeat(600), codeVerifier: 'v'.repeat(43), redirectUri: MOBILE_REDIRECT_URI }), null);
  assert.equal(parseTokenRequest({ refreshToken: '' }), null);
  assert.equal(parseTokenRequest(null), null);
  assert.equal(parseTokenRequest('code'), null);
});

test('tokenForm: the form Discord expects (secret sent by the server only)', () => {
  const code = new URLSearchParams(tokenForm({ kind: 'code', code: 'abc', codeVerifier: 'ver' }, 'SECRET'));
  assert.deepEqual(Object.fromEntries(code), {
    grant_type: 'authorization_code',
    code: 'abc',
    code_verifier: 'ver',
    redirect_uri: MOBILE_REDIRECT_URI,
    client_id: DISCORD_APP_ID,
    client_secret: 'SECRET',
  });
  const refresh = new URLSearchParams(tokenForm({ kind: 'refresh', refreshToken: 'r1' }, 'SECRET'));
  assert.equal(refresh.get('grant_type'), 'refresh_token');
  assert.equal(refresh.get('refresh_token'), 'r1');
});

test('readTokens: Discord answer → what the app reads; anything else → null', () => {
  assert.deepEqual(readTokens({ access_token: 'a', refresh_token: 'r', expires_in: 604800, token_type: 'Bearer', scope: 'openid' }), {
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 604800,
  });
  assert.equal(readTokens({ error: 'invalid_grant' }), null);
});
