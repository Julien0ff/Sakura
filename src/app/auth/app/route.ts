import { appDeepLink, bouncePage } from '@/lib/app-auth';

// Desktop sign-in: hand the OAuth result back to the app (sakura://). Plain HTML, no client JS.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return new Response(bouncePage(appDeepLink(params), !!params.get('code')), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}
