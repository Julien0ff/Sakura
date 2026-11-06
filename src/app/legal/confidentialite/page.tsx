import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Confidentialité" current="/legal/confidentialite">
      <p>
        {siteConfig.name} est conçu pour collecter le moins de données possible : pas de publicité, pas de traceur publicitaire ni de
        mesure d&apos;audience. Le compte est facultatif : sans compte, rien ne quitte votre appareil.
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
        <li>
          Si vous êtes connecté : <strong>sb-…-auth-token</strong> (votre session) et <strong>sakura-sync:…</strong> (l&apos;état de la
          synchronisation).
        </li>
      </ul>
      <p>
        Sans compte, ces données ne sont jamais envoyées à nos serveurs. Elles sont strictement nécessaires aux fonctionnalités que vous utilisez et ne
        requièrent donc pas de consentement (article 82 de la loi Informatique et Libertés). Le site ne dépose aucun cookie.
      </p>
      <p>
        Vous pouvez les effacer à tout moment depuis les <Link href="/settings">Paramètres</Link> ou en vidant les données du site dans votre
        navigateur.
      </p>

      <h2>Si vous créez un compte</h2>
      <p>
        La connexion se fait avec Discord ou Google. Nous recevons alors de ce service votre identifiant, votre adresse e-mail, votre nom
        d&apos;affichage et votre photo de profil. Nous ne recevons jamais votre mot de passe.
      </p>
      <p>Sont alors conservés, pour vous permettre de retrouver votre suivi sur tous vos appareils :</p>
      <ul>
        <li>les informations transmises par Discord ou Google, ainsi que les comptes que vous avez liés ;</li>
        <li>votre pseudo et, si vous en envoyez une, votre photo de profil ;</li>
        <li>votre liste (statuts, notes, favori), vos notes d&apos;épisodes, votre historique, votre position de lecture par épisode, vos bannières débloquées et vos réglages.</li>
      </ul>
      <p>
        <strong>Profil public</strong> : votre profil est privé par défaut. Si vous le rendez public, toute personne disposant du lien
        voit votre pseudo, votre nom d&apos;affichage, votre photo, votre bannière, vos trophées et uniquement les blocs que vous avez
        choisi d&apos;afficher (statistiques, animes en cours, terminés, notes…). Vos positions de lecture et votre adresse e-mail ne sont
        jamais publiées.
      </p>
      <p>
        <strong>Base légale</strong> : l&apos;exécution du service que vous demandez en créant un compte (article 6.1.b du RGPD).{' '}
        <strong>Hébergement</strong> : ces données sont stockées par Supabase, dans sa région de Paris (Union européenne). Supabase agit
        comme sous-traitant. Pour son support technique, des accès depuis les États-Unis restent possibles, encadrés par les clauses
        contractuelles types de la Commission européenne.{' '}
        <strong>Durée</strong> : tant que le compte existe. Les données ne sont ni vendues, ni partagées, ni utilisées à des fins
        publicitaires.
      </p>
      <p>
        <strong>Suppression</strong> : depuis les <Link href="/settings">Paramètres</Link>, « Supprimer mon compte » efface
        immédiatement votre profil, votre photo et toutes vos données synchronisées. La déconnexion retire ces données de
        l&apos;appareil utilisé.
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
        limitation sur les données vous concernant, ainsi que d&apos;un droit à la portabilité pour les données de votre compte. Sans
        compte, nous ne détenons aucune donnée vous identifiant et ces droits s&apos;exercent depuis votre appareil. Avec un compte, la
        plupart s&apos;exercent depuis les Paramètres (modification, suppression). Pour toute autre demande, écrivez à{' '}
        <a href={`mailto:${siteConfig.abuseEmail}`}>{siteConfig.abuseEmail}</a>. Vous pouvez aussi adresser une
        réclamation à la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
      </p>
    </LegalPage>
  );
}
