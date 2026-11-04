'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { setHapticsEnabled } from '@/lib/haptics';

function HapticsSync() {
  const on = useAppStore((s) => s.settings.haptics);
  useEffect(() => setHapticsEnabled(on), [on]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <HapticsSync />
        {children}
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
