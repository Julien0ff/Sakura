import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appKind } from './app-kind.ts';

test('appKind: website, desktop app, Android app, iPhone app', () => {
  assert.equal(appKind(false, 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile'), null);
  assert.equal(appKind(true, 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile'), 'android');
  assert.equal(appKind(true, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15'), 'ios');
  assert.equal(appKind(true, 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15'), 'ios');
  assert.equal(appKind(true, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15'), 'desktop');
  assert.equal(appKind(true, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Edg/140'), 'desktop');
  assert.equal(appKind(true, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15'), 'desktop');
});

test('an iPad app webview reporting a Mac user agent is still iOS (touch screen)', () => {
  assert.equal(appKind(true, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15', 5), 'ios');
});
