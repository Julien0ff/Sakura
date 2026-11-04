'use client';

import Link from 'next/link';
import { Home, Compass, Bookmark, Clock, Settings, Search, CalendarDays } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { haptic } from '@/lib/haptics';

export const navItems = [
  { name: 'Accueil', href: '/', icon: Home },
  { name: 'Recherche', href: '/search', icon: Search },
  { name: 'Découvrir', href: '/discover', icon: Compass },
  { name: 'Calendrier', href: '/calendar', icon: CalendarDays },
  { name: 'Ma Liste', href: '/watchlist', icon: Bookmark },
  { name: 'Historique', href: '/history', icon: Clock },
];

/** Tabs shown in the mobile tab bar: 5 max, one-word labels (HIG › Tab bars). */
const mobileTabs = [
  { name: 'Accueil', href: '/', icon: Home },
  { name: 'Découvrir', href: '/discover', icon: Compass },
  { name: 'Recherche', href: '/search', icon: Search },
  { name: 'Ma Liste', href: '/watchlist', icon: Bookmark },
  { name: 'Historique', href: '/history', icon: Clock },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Settings lives outside the tab bar on mobile (it's not a primary section). */}
      {pathname !== '/settings' && (
        <Link
          href="/settings"
          aria-label="Paramètres"
          onClick={() => haptic('selection')}
          className="md:hidden fixed z-40 right-4 top-[max(env(safe-area-inset-top),16px)] w-11 h-11 rounded-full tab-bar-glass flex items-center justify-center text-white/90 active:scale-95 transition-transform"
        >
          <Settings className="w-5 h-5" strokeWidth={2} />
        </Link>
      )}

      {/* Progressive blur + dim behind the bar so it always sits on a calm background. */}
      <div aria-hidden className="scroll-edge-bottom md:hidden z-30">
        <span />
        <span />
        <span />
      </div>

      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed z-40 left-3 right-3 bottom-[max(env(safe-area-inset-bottom),12px)]"
      >
        <ul className="tab-bar-glass rounded-[28px] flex items-stretch p-1.5 gap-1">
          {mobileTabs.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1 min-w-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => haptic(isActive ? 'light' : 'selection')}
                  className={`relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-semibold tracking-tight transition-colors duration-300 active:scale-95 ${
                    isActive ? 'text-white' : 'text-[#A1A1A6] hover:text-white/90'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[22px] bg-white/[0.16] animate-in fade-in zoom-in-90 duration-300"
                      style={{ boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.15)' }}
                    />
                  )}
                  <Icon className="relative w-[22px] h-[22px]" strokeWidth={isActive ? 2.4 : 1.9} />
                  <span className="tab-label relative truncate max-w-full px-1">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-[72px] h-[calc(100vh-32px)] fixed left-4 top-4 z-50 items-center py-6 glass-sidebar rounded-[24px] shadow-2xl shadow-black/50 border border-white/[0.05]">
      {/* Draggable region for Tauri / macOS */}
      <div className="absolute top-0 left-0 w-full h-10" data-tauri-drag-region />

      <div className="mb-10 mt-4 relative z-10">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-black/40">
          <img src="/icon.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col items-center gap-6 mt-4 relative z-10">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
                isActive 
                  ? 'shadow-lg shadow-black/40' 
                  : 'text-[#8E8E93] hover:bg-black/30 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: 'var(--anime-color, rgba(255,255,255,0.1))', color: 'var(--anime-on, #FFFFFF)' } : {}}
            >
              <Icon className={`w-6 h-6 ${isActive ? '' : 'opacity-80'}`} strokeWidth={isActive ? 2.5 : 2} />
              
              {isActive && (
                <div className="absolute -left-[12px] w-1.5 h-6 rounded-r-full" style={{ backgroundColor: 'var(--anime-color, #FFFFFF)' }} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mb-4 relative z-10">
        <Link
          href="/settings"
          title="Paramètres"
          aria-label="Paramètres"
          aria-current={pathname === '/settings' ? 'page' : undefined}
          className="flex items-center justify-center w-12 h-12 rounded-2xl text-[#8E8E93] hover:bg-white/10 hover:text-white transition-colors"
        >
          <Settings className="w-6 h-6 opacity-80" strokeWidth={2} />
        </Link>
      </div>
    </aside>
  );
}
