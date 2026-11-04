import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Confidentialité" current="/legal/confidentialite">
      <p>
        {siteConfig.name} est conçu pour collecter le moins de données possible : pas de compte, pas de publicité, pas de traceur
        publicitaire ni de mesure d&apos;audience.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {siteConfig.editor.name}
      </p>

      <h2>Données stockées sur votre appareil</h2>
      <p>Les informations suivantes sont enregistrées uniquement dans le stockage local (localStorage) de votre navigateur :</p>
      <ul>
        <li>
          <strong>sakura-store</strong> : votre liste, votre historique, la position de lecture de chaque épisode et vos réglages
          (langue, saut automatique, épisode suivant automatique).
        </li>
        <li>
          <strong>hasSeenWelcome</strong> : indique que le message de bienvenue a déjà été affiché.
        </li>
      </ul>
      <p>
        Ces données ne sont jamais envoyées à nos serveurs. Elles sont strictement nécessaires aux fonctionnalités que vous utilisez et ne
        requièrent donc pas de consentement (article 82 de la loi Informatique et Libertés). Le site ne dépose aucun cookie.
      </p>
      <p>
        Vous pouvez les effacer à tout moment depuis les <Link href="/settings">Paramètres</Link> ou en vidant les données du site dans votre
        navigateur.
      </p>

      <h2>Données techniques</h2>
      <p>
        Pour afficher le site, votre navigateur communique votre adresse IP et des informations techniques (navigateur, système) :
      </p>
      <ul>
        <li>à l&apos;hébergeur du site, qui peut conserver des journaux de connexion pour des raisons de sécurité ;</li>
        <li>
          aux services tiers interrogés directement par votre navigateur : AniList (métadonnées et images), AniSkip (horaires), TMDB (images),
          ainsi que les lecteurs vidéo tiers. Leurs propres politiques de confidentialité s&apos;appliquent.
        </li>
      </ul>
      <p>Les recherches TMDB passent par notre serveur, qui ne les conserve pas.</p>

      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, d&apos;opposition et de
        limitation sur les données vous concernant. Comme nous ne détenons aucune donnée vous identifiant, la plupart de ces droits
        s&apos;exercent directement depuis votre appareil. Vous pouvez aussi adresser une
        réclamation à la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
      </p>
    </LegalPage>
  );
}
