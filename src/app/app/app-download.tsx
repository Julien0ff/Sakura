'use client';

/* eslint-disable @next/next/no-img-element -- local icon */
import { useSyncExternalStore } from 'react';
import { AppIcon, Apple, ArrowDown, Bell, Beta, CodeIcon, Phone, Sparkles, Check } from '@/components/ui/icons';
import { DiscordIcon } from '@/components/account/provider-icons';
import { detectPlatform, type AppRelease, type Download, type Platform } from '@/lib/app-release';
import { isApp } from '@/lib/desktop';
import { haptic } from '@/lib/haptics';

const noop = () => () => {};
const clientPlatform = () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints);

const NAMES: Record<Platform, string> = {
  windows: 'Windows',
  linux: 'Linux',
  mac: 'macOS',
  android: 'Android',
  ios: 'iPhone',
  unknown: 'votre appareil',
};

function WindowsLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M3 5.5 10.5 4.5v7H3zM11.5 4.4 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.4z" />
    </svg>
  );
}

const PLATFORM_ICON: Record<'windows' | 'linux' | 'android' | 'ios', React.ComponentType<{ className?: string }>> = {
  windows: WindowsLogo,
  linux: CodeIcon,
  android: Phone,
  ios: Apple,
};

const FEATURES = [
  { icon: DiscordIcon, title: 'Statut Discord', text: '« Regarde <anime> · Épisode 12 » sur votre profil, pendant la lecture.' },
  { icon: Bell, title: 'Notifications de sortie', text: 'Un nouvel épisode d’un anime de votre liste ? Vous êtes prévenu, même fenêtre fermée.' },
  { icon: Sparkles, title: 'Toujours à jour', text: 'L’interface suit le site en direct, l’application se met à jour toute seule.' },
];

const sizeMb = (b: number) => `${Math.max(1, Math.round(b / 1_048_576))} Mo`;
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function BetaBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#BF5AF2]/20 border border-[#BF5AF2]/40 text-[#DA8FFF] text-[11px] font-bold uppercase tracking-wide">
      <Beta className="w-3 h-3" aria-hidden /> Bêta
    </span>
  );
}

function DownloadButton({ d, primary = false, platform }: { d: Download; primary?: boolean; platform: string }) {
  return (
    <a
      href={d.url}
      onClick={() => haptic('success')}
      className={
        primary
          ? 'inline-flex items-center justify-center gap-2.5 h-14 px-7 rounded-2xl bg-white text-black font-bold text-[17px] hover:bg-white/90 active:scale-[0.98] transition-all'
          : 'flex items-center justify-between gap-3 px-4 h-12 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] text-[15px] text-white transition-colors'
      }
    >
      {primary ? (
        <>
          <ArrowDown className="w-5 h-5" /> Télécharger pour {platform}
        </>
      ) : (
        <>
          <span>{d.label}</span>
          <span className="flex items-center gap-2 text-[13px] text-[#8E8E93]">
            {sizeMb(d.size)} <ArrowDown className="w-4 h-4" />
          </span>
        </>
      )}
    </a>
  );
}

/** Main call to action for the visitor's own device. */
function ForYou({ platform, release }: { platform: Platform; release: AppRelease | null }) {
  if (platform === 'windows' || platform === 'linux') {
    const list = release?.downloads[platform];
    if (!list?.length) return <p className="text-[#8E8E93]">La première version arrive très bientôt.</p>;
    return (
      <div className="flex flex-col gap-3">
        <DownloadButton d={list[0]} primary platform={NAMES[platform]} />
        <p className="text-[13px] text-[#8E8E93]">
          {list[0].label} · {sizeMb(list[0].size)}
          {platform === 'windows' && ' · Windows peut afficher « éditeur inconnu » : cliquez sur « Informations complémentaires », puis « Exécuter quand même ».'}
          {platform === 'linux' && ' · Rendez le fichier exécutable, puis lancez-le. Mises à jour automatiques.'}
        </p>
      </div>
    );
  }
  if (platform === 'android') {
    const apk = release?.downloads.android?.[0];
    return apk ? (
      <div className="flex flex-col gap-3">
        <DownloadButton d={apk} primary platform="Android" />
        <p className="text-[13px] text-[#8E8E93] flex items-center gap-2">
          <BetaBadge /> Autorisez l’installation depuis votre navigateur si Android le demande.
        </p>
      </div>
    ) : (
      <ComingSoon name="Android" />
    );
  }
  if (platform === 'ios') {
    const ipa = release?.downloads.ios?.[0];
    return ipa ? (
      <div className="flex flex-col gap-3">
        <DownloadButton d={ipa} primary platform="iPhone" />
        <p className="text-[13px] text-[#8E8E93] flex flex-wrap items-center gap-2 max-w-md">
          <BetaBadge /> Installez le fichier avec AltStore ou SideStore (compte Apple gratuit). Ils renouvellent l’app tous les 7 jours.
        </p>
      </div>
    ) : (
      <ComingSoon name="iPhone" pwa />
    );
  }
  if (platform === 'mac') {
    return <p className="text-[#8E8E93]">Pas encore de version macOS. Le site fonctionne parfaitement dans Safari ou Chrome en attendant.</p>;
  }
  return <p className="text-[#8E8E93]">Choisissez votre plateforme ci-dessous.</p>;
}

function ComingSoon({ name, pwa = false }: { name: string; pwa?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex items-center gap-2 h-14 px-6 rounded-2xl bg-white/[0.08] text-white font-semibold self-start">
        Bientôt sur {name} <BetaBadge />
      </div>
      <p className="text-[13px] text-[#8E8E93] max-w-md">
        {pwa
          ? 'En attendant, ajoutez SAKURA à votre écran d’accueil : dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».'
          : 'La bêta mobile est en préparation. En attendant, le site est pensé pour le téléphone.'}
      </p>
    </div>
  );
}

export function AppDownload({ release }: { release: AppRelease | null }) {
  const platform = useSyncExternalStore(noop, clientPlatform, () => 'unknown' as Platform);
  const inApp = useSyncExternalStore(noop, isApp, () => false);
  // No « Version 0.2.0 » on a phone that has no build yet.
  const own = platform === 'windows' || platform === 'linux' || platform === 'android' || platform === 'ios' ? release?.downloads[platform] : undefined;
  const showVersion = !!own?.length || platform === 'unknown' || platform === 'mac';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 md:pr-10 pt-page-lg pb-24">
      <div className="max-w-5xl">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-gradient-to-br from-[#FF7AA8]/20 via-[#141416] to-[#141416] p-6 md:p-10">
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-[#FF7AA8]/20 blur-3xl pointer-events-none" aria-hidden />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <img src="/icon.png" alt="" className="w-20 h-20 md:w-28 md:h-28 rounded-[24px] md:rounded-[30px] shadow-2xl ring-1 ring-white/15" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-sakura flex items-center gap-2">
                <AppIcon className="w-4 h-4" /> Application
              </p>
              <h1 className="mt-1 text-[38px] md:text-[56px] leading-none font-bold text-white" style={{ fontFamily: 'var(--font-impact)' }}>
                SAKURA pour {NAMES[platform]}
              </h1>
              {release && showVersion && (
                <p className="mt-2 text-[14px] text-[#8E8E93] flex flex-wrap items-center gap-2">
                  Version {release.version}
                  {release.publishedAt && ` · ${dateFmt.format(new Date(release.publishedAt))}`}
                  {release.beta && <BetaBadge />}
                </p>
              )}
              <div className="mt-6">
                {inApp ? (
                  <p className="inline-flex items-center gap-2 text-white font-semibold">
                    <Check className="w-5 h-5 text-[#30D158]" /> Vous utilisez déjà l’application. Elle se met à jour toute seule.
                  </p>
                ) : (
                  <ForYou platform={platform} release={release} />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Why the app */}
        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
              <span className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center text-white">
                <Icon className="w-5 h-5" />
              </span>
              <h2 className="mt-3 text-[16px] font-semibold text-white">{title}</h2>
              <p className="mt-1 text-[14px] leading-snug text-[#8E8E93]">{text}</p>
            </div>
          ))}
        </section>

        {/* Every platform */}
        <section className="mt-10">
          <h2 className="text-[22px] font-bold text-white mb-4">Toutes les plateformes</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(['windows', 'linux', 'android', 'ios'] as const).map((p) => {
              const Icon = PLATFORM_ICON[p];
              const list = release?.downloads[p] ?? [];
              const mobile = p === 'android' || p === 'ios';
              return (
                <div key={p} className={`rounded-2xl border p-5 ${p === platform ? 'bg-white/[0.07] border-[#FF7AA8]/40' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center text-white">
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
                        {NAMES[p]} {mobile && <BetaBadge />}
                      </h3>
                      <p className="text-[13px] text-[#8E8E93]">
                        {list.length ? `Version ${release!.version}` : mobile ? 'Bientôt disponible' : 'Première version très bientôt'}
                      </p>
                    </div>
                    {p === platform && <span className="text-[11px] font-bold uppercase tracking-wide text-sakura">Votre appareil</span>}
                  </div>
                  {list.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {list.map((d) => (
                        <DownloadButton key={d.url} d={d} platform={NAMES[p]} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {release && (
            <a href={release.url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-[14px] text-[#8E8E93] underline underline-offset-4 hover:text-white">
              Notes de version et anciennes versions sur GitHub
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
