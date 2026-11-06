'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, History, FastForward, CalendarDays } from '@/components/ui/icons';
import { useAppStore, type Lang } from '@/core/store';
import { siteConfig } from '@/lib/site-config';
import { haptic } from '@/lib/haptics';

const STORAGE_KEY = 'hasSeenWelcome';

const FEATURES = [
  { icon: History, title: 'Reprenez où vous étiez', text: 'Position, épisodes vus et historique, mémorisés automatiquement.' },
  { icon: FastForward, title: 'Passez les génériques', text: "Opening et ending en un clic, ou automatiquement." },
  { icon: CalendarDays, title: 'Suivez les sorties', text: 'Le calendrier de la semaine, vos séries en premier.' },
];

export function WelcomePopup() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const defaultLang = useAppStore((s) => s.settings.defaultLang);
  const updateSettings = useAppStore((s) => s.updateSettings);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Let the page paint first so the dialog doesn't compete with the hero.
    const t = setTimeout(() => dialogRef.current?.showModal(), 600);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setClosing(true);
    // Matches the exit animation duration below.
    setTimeout(() => {
      dialogRef.current?.close();
      setClosing(false);
    }, 200);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="welcome-title"
      // Native <dialog>: focus trap, inert background and Escape handling come for free.
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) close(); // backdrop click
      }}
      className={`welcome-dialog m-auto w-[min(100vw-2rem,30rem)] md:w-[min(100vw-4rem,46rem)] max-h-[min(100dvh-2rem,44rem)] p-0 rounded-[28px] bg-transparent text-white overflow-visible ${
        closing ? 'welcome-out' : ''
      }`}
    >
      <div className="relative flex flex-col max-h-[min(100dvh-2rem,44rem)] overflow-hidden rounded-[28px] border border-white/10 bg-[#141416] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        {/* Art: the banner fades into the card instead of ending on a hard edge */}
        <div className="relative shrink-0 h-32 sm:h-48 md:h-56">
          <img src="/banner.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#141416]/40 to-[#141416]" />
          <img src="/icon.png" alt="" className="absolute left-6 md:left-8 -bottom-6 w-14 h-14 rounded-2xl shadow-xl ring-1 ring-white/15" />
        </div>

        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md text-white hover:bg-black/65 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="min-h-0 flex-1 px-6 md:px-8 pt-10 pb-6 md:pb-8 overflow-y-auto overscroll-contain scrollbar-none">
          <h2 id="welcome-title" className="text-[34px] md:text-[44px] leading-none font-bold" style={{ fontFamily: 'var(--font-impact)' }}>
            Bienvenue sur {siteConfig.name}
          </h2>
          <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-[#EBEBF5]/75 max-w-xl">
            Vos animes, sans publicité, avec un suivi qui se souvient de tout. Projet open-source et gratuit, compte facultatif.
          </p>

          <ul className="mt-5 md:mt-7 grid gap-3.5 md:grid-cols-3 md:gap-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5 md:flex-col md:gap-3 md:p-4 md:rounded-2xl md:bg-white/[0.04] md:border md:border-white/[0.06]">
                <span className="shrink-0 w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="block text-[13px] leading-snug text-[#8E8E93]">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 md:mt-7 flex flex-col md:flex-row md:items-end gap-5 md:gap-4">
          {/* First preference, asked in context instead of buried in Settings */}
            <fieldset className="md:flex-1">
              <legend className="text-[13px] font-medium text-[#8E8E93] mb-2">Vous regardez plutôt en…</legend>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/[0.06]" role="radiogroup">
                {(['vostfr', 'vf'] as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="radio"
                    aria-checked={defaultLang === lang}
                    onClick={() => {
                  haptic('selection');
                  updateSettings({ defaultLang: lang });
                }}
                    className={`h-10 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                      defaultLang === lang ? 'bg-white text-black' : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {lang === 'vostfr' ? 'VOSTFR' : 'VF'}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              onClick={close}
              autoFocus
              className="w-full md:w-56 h-12 rounded-2xl bg-white text-black font-semibold text-[16px] hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer"
            >
              C&apos;est parti
            </button>
          </div>
          <p className="mt-4 text-center md:text-left text-[12px] text-[#636366]">
            En continuant, vous acceptez les{' '}
            <Link href="/legal/cgu" onClick={close} className="underline underline-offset-2 hover:text-white">
              conditions d&apos;utilisation
            </Link>
            . Aucun cookie ; sans compte, vos données restent sur cet appareil.
          </p>
        </div>
      </div>
    </dialog>
  );
}
