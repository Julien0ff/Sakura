import Link from 'next/link';
import { legalLinks, siteConfig } from '@/lib/site-config';

const YEAR = new Date().getFullYear();

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
const linkCls = 'underline underline-offset-2 hover:text-white';

export function Footer() {
  return (
    <footer className="relative mt-10 md:mt-16 px-5 md:pl-32 md:pr-10 pt-6 md:pt-10 pb-4 md:pb-10 border-t border-white/[0.06] text-[12px] md:text-[13px] text-[#8E8E93]">
      {/* ───────── Mobile: compact, ~4 lines ───────── */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2 text-white">
          <img src="/icon.png" alt="" className="w-6 h-6 rounded-md" />
          <span className="font-semibold text-[14px]">{siteConfig.name}</span>
          <span className="text-[#636366] text-[11px] ml-auto">© {YEAR} · GPL-3.0</span>
        </div>
        <nav aria-label="Informations légales">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-[11px] leading-relaxed text-[#636366]">
          Aucune vidéo hébergée. Données{' '}
          <a href="https://anilist.co" {...ext} className={linkCls}>AniList</a>,{' '}
          <a href="https://www.themoviedb.org" {...ext} className={linkCls}>TMDB</a>,{' '}
          <a href="https://aniskip.com" {...ext} className={linkCls}>AniSkip</a>. Ce produit utilise l&apos;API TMDB mais n&apos;est ni
          approuvé ni certifié par TMDB.
        </p>
      </div>

      {/* ───────── Desktop ───────── */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between gap-8">
          <div className="max-w-md space-y-3">
            <div className="flex items-center gap-3 text-white">
              <img src="/icon.png" alt="" className="w-8 h-8 rounded-lg" />
              <span className="font-semibold text-[15px]">{siteConfig.name}</span>
            </div>
            <p className="leading-relaxed">
              {siteConfig.name} n&apos;héberge aucun fichier vidéo. Les fiches, visuels et titres appartiennent à leurs ayants droit respectifs.
            </p>
          </div>

          <nav aria-label="Informations légales">
            <ul className="space-y-2.5">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="max-w-xs space-y-2 leading-relaxed">
            <p className="text-white/80 font-medium">Données</p>
            <p>
              Métadonnées : <a href="https://anilist.co" {...ext} className={linkCls}>AniList</a>
              {' · '}
              <a href="https://www.themoviedb.org" {...ext} className={linkCls}>TMDB</a>
              {' · '}
              <a href="https://aniskip.com" {...ext} className={linkCls}>AniSkip</a>
            </p>
            <p>Ce produit utilise l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.</p>
          </div>
        </div>

        <p className="mt-10 text-[12px] text-[#636366]">
          © {YEAR} {siteConfig.name} — logiciel libre sous licence{' '}
          <a href={siteConfig.licenseUrl} {...ext} className={linkCls}>
            GPL-3.0
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
