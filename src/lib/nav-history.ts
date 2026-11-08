'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** In-app navigations since the page was loaded: when 0, there is no SAKURA page to go back to. */
let navigations = 0;

/** Mounted once (providers): counts route changes. */
export function NavTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    navigations++;
  }, [pathname, search]);
  return null;
}

/** « Back » that returns to the previous SAKURA page (a search keeps its query), or home. */
export function useBack(fallback = '/') {
  const router = useRouter();
  return () => (navigations > 0 ? router.back() : router.push(fallback));
}
