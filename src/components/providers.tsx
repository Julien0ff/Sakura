'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { setHapticsEnabled, setHapticIntensity } from '@/lib/haptics';
import { AuthBootstrap } from '@/core/auth';
import { SyncBootstrap } from '@/core/sync/engine';
import { Toaster } from '@/components/ui/toast';
import { DesktopBridge } from '@/components/desktop/desktop-bridge';
import { detectPlatform } from '@/lib/app-release';

function HapticsSync() {
  const on = useAppStore((s) => s.settings.haptics);
  const level = useAppStore((s) => s.settings.hapticIntensity);
  useEffect(() => setHapticsEnabled(on), [on]);
  useEffect(() => setHapticIntensity(level), [level]);
  return null;
}

/** Settings › Apparence › Liquid Glass: iPhone only (a synced setting must not restyle the PC). */
function UiStyleSync() {
  const style = useAppStore((s) => s.settings.uiStyle ?? 'default');
  useEffect(() => {
    const ios = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios';
    document.documentElement.classList.toggle('ui-liquid', ios && style === 'liquid');
  }, [style]);
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
        <UiStyleSync />
        <AuthBootstrap />
        <SyncBootstrap />
        <DesktopBridge />
        {children}
        <Toaster />
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
