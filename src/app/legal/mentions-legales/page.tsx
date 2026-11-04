import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  const { editor, host } = siteConfig;
  return (
    <LegalPage title="Mentions légales" current="/legal/mentions-legales">
      <p>
        Conformément à l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN), voici
        l&apos;identité des différents intervenants du site {siteConfig.name}.
      </p>

      <h2>Éditeur</h2>
      <dl>
        <dt>Nom</dt>
        <dd>{editor.name}</dd>
        <dt>Statut</dt>
        <dd>{editor.status}</dd>
        <dt>Directeur·rice de la publication</dt>
        <dd>{editor.publicationDirector}</dd>
      </dl>

      <h2>Hébergeur</h2>
      <dl>
        <dt>Nom</dt>
        <dd>{host.name}</dd>
        <dt>Adresse</dt>
        <dd>{host.address}</dd>
        <dt>Contact</dt>
        <dd>{host.contact}</dd>
      </dl>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le code source de {siteConfig.name} est un logiciel libre distribué sous licence{' '}
        <a href={siteConfig.licenseUrl} target="_blank" rel="noopener noreferrer">GNU GPL v3.0 ou ultérieure</a> : vous pouvez le
        réutiliser, le modifier et le redistribuer dans les conditions de cette licence. Le nom, le logo et les visuels
        {' '}{siteConfig.name} restent attachés au projet. Les titres, synopsis, affiches, bannières, captures
        et marques des œuvres présentées appartiennent à leurs ayants droit respectifs ; ils sont affichés à des fins d&apos;identification
        des œuvres.
      </p>

      <h2>Données et services tiers</h2>
      <ul>
        <li>
          Métadonnées et visuels : <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a> et{' '}
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">The Movie Database (TMDB)</a>. Ce produit utilise
          l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.
        </li>
        <li>
          Horaires d&apos;opening et d&apos;ending : <a href="https://aniskip.com" target="_blank" rel="noopener noreferrer">AniSkip</a>{' '}
          (base communautaire).
        </li>
      </ul>

      <h2>Contenus vidéo</h2>
      <p>
        {siteConfig.name} n&apos;héberge aucun fichier vidéo sur ses serveurs. Les lecteurs affichés proviennent de services tiers sur lesquels
        l&apos;éditeur n&apos;exerce aucun contrôle. Tout ayant droit peut demander le retrait d&apos;un contenu via la page{' '}
        <Link href="/legal/signalement">Signaler un contenu</Link> ; les demandes fondées sont traitées promptement.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Voir la <Link href="/legal/confidentialite">politique de confidentialité</Link>.
      </p>
    </LegalPage>
  );
}
