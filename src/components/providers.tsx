'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { setHapticsEnabled, setHapticIntensity } from '@/lib/haptics';
import { AuthBootstrap } from '@/core/auth';
import { SyncBootstrap } from '@/core/sync/engine';
import { Toaster } from '@/components/ui/toast';

function HapticsSync() {
  const on = useAppStore((s) => s.settings.haptics);
  const level = useAppStore((s) => s.settings.hapticIntensity);
  useEffect(() => setHapticsEnabled(on), [on]);
  useEffect(() => setHapticIntensity(level), [level]);
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
        <AuthBootstrap />
        <SyncBootstrap />
        {children}
        <Toaster />
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
