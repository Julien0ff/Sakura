'use client';

/* eslint-disable @next/next/no-img-element -- local art */
import { useEffect, useState } from 'react';
import { Beta, Sparkles, Tasks, X } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { CHANGELOG_APP_VERSION_KEY, CHANGELOG_SEEN_KEY, LATEST_CHANGELOG, changelogDue, type ChangelogLine } from '@/lib/changelog';
import { desktop, isMobileApp } from '@/lib/desktop';
import { haptic } from '@/lib/haptics';

/** Event that reopens the popup (Settings › Nouveautés). */
export const OPEN_CHANGELOG_EVENT = 'sakura:changelog';

export function openChangelog() {
  window.dispatchEvent(new Event(OPEN_CHANGELOG_EVENT));
}

function BetaBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-md bg-[#BF5AF2]/20 border border-[#BF5AF2]/40 text-[#DA8FFF] text-[10px] font-bold uppercase tracking-wide leading-4 align-[2px]">
      <Beta className="w-3 h-3" aria-hidden /> Bêta
    </span>
  );
}

function Section({ icon: Icon, title, tint, lines }: { icon: typeof Sparkles; title: string; tint: string; lines: ChangelogLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-white mb-3">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tint}26`, color: tint }}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        {title}
      </h3>
      <ul className="space-y-2.5">
        {lines.map((l) => (
          <li key={l.text} className="flex gap-3 text-[14px] leading-snug text-[#EBEBF5]/85">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tint }} aria-hidden />
            <span>
              {l.text} {l.beta && <BetaBadge />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * « Quoi de neuf » : shown once per release to returning visitors (first-time visitors get the
 * welcome popup instead), after each update of the mobile apps, and on demand from the settings.
 */
export function ChangelogPopup() {
  const [open, setOpen] = useState(false);

  // Mobile apps: the installed version, to announce an update on the first launch after it.
  const [appVersion, setAppVersion] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    void (async () => {
      const version = isMobileApp() ? await desktop.version().catch(() => null) : null;
      if (cancelled) return;
      setAppVersion(version);
      const welcomed = !!localStorage.getItem('hasSeenWelcome');
      const app = version ? { version, seen: localStorage.getItem(CHANGELOG_APP_VERSION_KEY) } : undefined;
      if (!welcomed) {
        // New visitor / fresh install: the welcome popup already presents everything.
        localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_CHANGELOG.id);
        if (version) localStorage.setItem(CHANGELOG_APP_VERSION_KEY, version);
      } else if (changelogDue({ welcomed, seenId: localStorage.getItem(CHANGELOG_SEEN_KEY), latestId: LATEST_CHANGELOG.id, app })) {
        t = setTimeout(() => setOpen(true), 900);
      }
    })();
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CHANGELOG_EVENT, reopen);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener(OPEN_CHANGELOG_EVENT, reopen);
    };
  }, []);

  if (!open) return null;
  const c = LATEST_CHANGELOG;

  return (
    <Sheet
      width="lg"
      label={`Nouveautés : ${c.title}`}
      onClose={() => {
        localStorage.setItem(CHANGELOG_SEEN_KEY, c.id);
        if (appVersion) localStorage.setItem(CHANGELOG_APP_VERSION_KEY, appVersion);
        setOpen(false);
      }}
    >
      {(close) => (
        <>
          <div className="relative -mx-4 -mt-4 md:-mx-7 md:-mt-6 aspect-[3/1] overflow-hidden">
            <img src={c.banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[#141416]" />
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md text-white hover:bg-black/65 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mt-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-sakura flex items-center gap-2">
              Nouveautés · {c.date} {c.beta && <BetaBadge />}
            </p>
            <h2 className="mt-1 text-[30px] md:text-[36px] leading-none font-bold text-white" style={{ fontFamily: 'var(--font-impact)' }}>
              {c.title}
            </h2>

            <div className="mt-6 grid gap-6 md:grid-cols-[3fr_2fr] md:gap-8">
              <Section icon={Sparkles} title="Nouveautés" tint="#FF7AA8" lines={c.features} />
              <Section icon={Tasks} title="Correctifs" tint="#30D158" lines={c.fixes} />
            </div>

            <button
              type="button"
              autoFocus
              onClick={() => {
                haptic('selection');
                close();
              }}
              className="mt-7 w-full md:w-56 md:ml-auto md:flex md:items-center md:justify-center h-12 rounded-2xl bg-white text-black font-semibold text-[16px] hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer"
            >
              Super !
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
