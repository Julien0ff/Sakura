import { Sidebar, MobileNav } from './sidebar';
import { WelcomePopup } from './welcome-popup';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-dvh w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Ambient color wash driven by --anime-color / --hero-progress (see globals.css) */}
      <div className="ambient-tint" aria-hidden />

      <Sidebar />
      <WelcomePopup />

      <main id="main-scroll" className="absolute inset-0 z-[1] h-full w-full overflow-y-auto overflow-x-hidden scrollbar-none">
        {/* Bottom padding keeps the last row clear of the floating mobile tab bar. */}
        <div className="min-h-full pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      </main>

      <MobileNav />
    </div>
  );
}
