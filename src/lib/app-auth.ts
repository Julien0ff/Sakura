/**
 * Desktop sign-in bounce (`/auth/app`): the OAuth provider returns to the website in the system
 * browser; this page hands the code back to the app through `sakura://auth/callback`.
 * Pure module (no imports) so `node --test` can load it.
 */

const FORWARDED = ['code', 'next', 'error', 'error_description'] as const;

const safeNext = (v: string) => v.startsWith('/') && !v.startsWith('//');

/** `sakura://auth/callback?…` with only the OAuth result and a same-site `next`. */
export function appDeepLink(params: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const key of FORWARDED) {
    const v = params.get(key);
    if (v == null || v === '') continue;
    if (key === 'next' && !safeNext(v)) continue;
    out.set(key, v);
  }
  const qs = out.toString();
  return `sakura://auth/callback${qs ? `?${qs}` : ''}`;
}

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Small standalone HTML page (no React, no Supabase client: nobody else may redeem the code). */
export function bouncePage(deepLink: string, hasCode: boolean): string {
  const hasError = /[?&]error=/.test(deepLink);
  const redirect = hasCode || hasError;
  const href = attr(deepLink);
  const body = redirect
    ? `<h1>Retournez dans SAKURA</h1>
       <p>${hasError ? 'La connexion a été annulée ou refusée. L’application va vous l’indiquer.' : 'Connexion réussie. L’application SAKURA va s’ouvrir.'}</p>
       <a class="btn" href="${href}">Ouvrir SAKURA</a>
       <p class="hint">Vous pouvez fermer cet onglet ensuite.</p>`
    : `<h1>Lien de connexion invalide</h1>
       <p>Relancez la connexion depuis l’application SAKURA.</p>`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
${redirect ? `<meta http-equiv="refresh" content="0;url=${href}">` : ''}
<title>SAKURA</title>
<link rel="icon" href="/icon.png">
<style>
  html,body{height:100%;margin:0}
  body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}
  main{max-width:420px}
  img{width:72px;height:72px;border-radius:18px}
  h1{font-size:24px;margin:20px 0 8px}
  p{color:#8E8E93;line-height:1.5;margin:0 0 20px}
  .btn{display:inline-block;background:#FF7AA8;color:#000;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:999px}
  .hint{margin-top:20px;font-size:13px}
</style>
</head>
<body><main><img src="/icon.png" alt="">${body}</main></body>
</html>`;
}

/** OAuth `redirectTo` used inside the desktop app: the bounce page on the site's own origin. */
export function appRedirectUrl(origin: string, next?: string): string {
  const u = new URL('/auth/app', origin);
  if (next && safeNext(next)) u.searchParams.set('next', next);
  return u.toString();
}
