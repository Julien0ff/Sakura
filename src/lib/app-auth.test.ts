import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appDeepLink, appRedirectUrl, bouncePage } from './app-auth.ts';

test('appDeepLink forwards code and a safe next, drops the rest', () => {
  assert.equal(
    appDeepLink(new URLSearchParams('code=abc&next=/anime?id=1&foo=x')),
    'sakura://auth/callback?code=abc&next=%2Fanime%3Fid%3D1'
  );
});

test('appDeepLink drops protocol-relative next and keeps OAuth errors', () => {
  const link = appDeepLink(new URLSearchParams('next=//evil.com&error=access_denied&error_description=Nope'));
  assert.equal(link, 'sakura://auth/callback?error=access_denied&error_description=Nope');
});

test('bouncePage redirects to the app when there is a code', () => {
  const link = 'sakura://auth/callback?code=a&next=%2F';
  const html = bouncePage(link, true);
  assert.match(html, /http-equiv="refresh" content="0;url=sakura:\/\/auth\/callback\?code=a&amp;next=%2F"/);
  assert.match(html, /<a [^>]*href="sakura:\/\/auth\/callback\?code=a&amp;next=%2F"/);
  assert.match(html, /Retournez dans SAKURA/);
});

test('bouncePage without code nor error says the link is invalid, no redirect', () => {
  const html = bouncePage('sakura://auth/callback', false);
  assert.match(html, /Lien de connexion invalide/);
  assert.doesNotMatch(html, /http-equiv="refresh"/);
});

test('appRedirectUrl points the provider to /auth/app with a safe next', () => {
  assert.equal(appRedirectUrl('https://sakura.thefoxy.me', '/settings'), 'https://sakura.thefoxy.me/auth/app?next=%2Fsettings');
  assert.equal(appRedirectUrl('http://localhost:3000', '//evil.com'), 'http://localhost:3000/auth/app');
  assert.equal(appRedirectUrl('http://localhost:3000'), 'http://localhost:3000/auth/app');
});
