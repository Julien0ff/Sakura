import { Sidebar, MobileNav } from './sidebar';
import { WelcomePopup } from './welcome-popup';
import { ChangelogPopup } from './changelog-popup';
import { Footer } from './footer';
import { ScrollEffectsFallback } from './scroll-effects-fallback';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-root relative h-dvh w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Ambient color field driven by --anime-color; its layers fade with the scroll timeline (globals.css). */}
      <div className="ambient" aria-hidden>
        <div className="ambient-wash" />
        <div className="ambient-glow" />
      </div>

      <Sidebar />
      <WelcomePopup />
      <ChangelogPopup />

      <main id="main-scroll" className="absolute inset-0 z-[1] h-full w-full overflow-y-auto overflow-x-hidden scrollbar-none">
        <div className="min-h-full flex flex-col">
          <div className="flex-1">{children}</div>
          <Footer />
          {/* Keeps the footer clear of the floating mobile tab bar. */}
          <div aria-hidden className="md:hidden h-[calc(96px+env(safe-area-inset-bottom))] shrink-0" />
        </div>
      </main>

      <MobileNav />
      <ScrollEffectsFallback />
    </div>
  );
}
