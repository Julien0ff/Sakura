import Link from 'next/link';
import { legalLinks, siteConfig } from '@/lib/site-config';

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="relative mt-16 px-6 md:pl-32 md:pr-10 pt-10 pb-10 border-t border-white/[0.06] text-[13px] text-[#8E8E93]">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
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
          <ul className="grid grid-cols-2 md:grid-cols-1 gap-x-6 gap-y-2.5">
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
            Métadonnées :{' '}
            <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">AniList</a>
            {' · '}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">TMDB</a>
            {' · '}
            <a href="https://aniskip.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">AniSkip</a>
          </p>
          <p>Ce produit utilise l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.</p>
        </div>
      </div>

      <p className="mt-10 text-[12px] text-[#636366]">
        © {YEAR} {siteConfig.name} — logiciel libre sous licence{' '}
        <a href={siteConfig.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
          GPL-3.0
        </a>
        .
      </p>
    </footer>
  );
}
