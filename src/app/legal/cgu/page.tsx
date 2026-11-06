import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Conditions d’utilisation' };

export default function CguPage() {
  return (
    <LegalPage title="Conditions d’utilisation" current="/legal/cgu">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions encadrent l&apos;utilisation de {siteConfig.name}, un service gratuit de catalogue et de suivi de
        visionnage d&apos;animes. En utilisant le site, vous les acceptez.
      </p>

      <h2>2. Accès au service</h2>
      <p>
        Le service est accessible gratuitement, sans inscription obligatoire. L&apos;éditeur peut le modifier, le suspendre ou l&apos;interrompre à tout
        moment, notamment pour maintenance, sans que cela n&apos;ouvre droit à indemnité.
      </p>

      <h2>3. Compte</h2>
      <p>
        Un compte facultatif, créé avec Discord ou Google, permet de synchroniser votre suivi entre vos appareils. Vous êtes responsable
        de l&apos;usage de votre compte et du pseudo comme de la photo de profil que vous choisissez : ils ne doivent pas usurper
        l&apos;identité d&apos;un tiers, ni être injurieux, haineux ou contraires à la loi. L&apos;éditeur peut modifier un pseudo ou
        une photo qui ne respecte pas ces règles, ou supprimer le compte concerné. Vous pouvez supprimer votre compte à tout moment depuis
        les Paramètres.
      </p>

      <h2>4. Utilisation</h2>
      <p>Vous vous engagez à utiliser le service à titre personnel et à ne pas :</p>
      <ul>
        <li>porter atteinte à son fonctionnement (surcharge, extraction automatisée massive, contournement de mesures de sécurité) ;</li>
        <li>l&apos;utiliser pour diffuser ou reproduire des contenus en violation des droits de tiers.</li>
      </ul>

      <h2>5. Contenus et liens tiers</h2>
      <p>
        Les métadonnées proviennent d&apos;AniList et de TMDB, et les contenus vidéo de services tiers indépendants de l&apos;éditeur.
        L&apos;éditeur ne garantit ni leur exactitude, ni leur disponibilité, ni leur licéité, et n&apos;est pas responsable des sites vers
        lesquels pointent des liens externes. Un contenu litigieux peut être signalé via la page{' '}
        <Link href="/legal/signalement">Signaler un contenu</Link>.
      </p>

      <h2>6. Responsabilité</h2>
      <p>
        Le service est fourni « en l&apos;état ». L&apos;éditeur met en œuvre des moyens raisonnables pour en assurer le bon fonctionnement
        mais ne peut garantir l&apos;absence d&apos;erreur ou d&apos;interruption. Sans compte, les données de suivi étant stockées sur votre
        appareil, leur perte (changement d&apos;appareil, nettoyage du navigateur) ne peut lui être imputée.
      </p>

      <h2>7. Propriété intellectuelle</h2>
      <p>
        Le code source est distribué sous licence{' '}
        <a href={siteConfig.licenseUrl} target="_blank" rel="noopener noreferrer">GNU GPL v3.0 ou ultérieure</a>. Les œuvres, titres et
        visuels présentés restent la propriété de leurs ayants droit.
      </p>

      <h2>8. Modification et droit applicable</h2>
      <p>
        Ces conditions peuvent évoluer ; la version en vigueur est celle publiée sur cette page. Elles sont soumises au droit français. En
        cas de litige, une solution amiable sera recherchée avant toute action devant les tribunaux compétents.
      </p>
    </LegalPage>
  );
}
