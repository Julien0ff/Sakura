import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Signaler un contenu' };

export default function SignalementPage() {
  return (
    <LegalPage title="Signaler un contenu" current="/legal/signalement">
      <p>
        Vous êtes titulaire de droits ou vous estimez qu&apos;un contenu accessible depuis {siteConfig.name} est illicite ? Écrivez à{' '}
        <strong>{siteConfig.abuseEmail}</strong>. Les demandes complètes et fondées sont traitées dans les meilleurs délais, et le contenu
        concerné est retiré ou rendu inaccessible.
      </p>

      <h2>Informations à fournir</h2>
      <p>Pour que votre signalement puisse être traité (article 6 I-5 de la LCEN), indiquez :</p>
      <ul>
        <li>votre identité : nom, prénom et adresse électronique, ou pour une personne morale sa dénomination et son siège ;</li>
        <li>la description du contenu litigieux et son adresse précise (lien de la fiche et numéro d&apos;épisode) ;</li>
        <li>les motifs du retrait, avec les dispositions légales concernées et, le cas échéant, la preuve de vos droits sur l&apos;œuvre ;</li>
        <li>
          le cas échéant, la copie de la correspondance adressée à l&apos;auteur ou à l&apos;éditeur du contenu, ou la justification de
          l&apos;impossibilité de le contacter.
        </li>
      </ul>

      <h2>Bon à savoir</h2>
      <p>
        {siteConfig.name} n&apos;héberge pas de fichier vidéo : un signalement adressé également au service qui héberge la vidéo permet son
        retrait à la source. Présenter sciemment un contenu comme illicite afin d&apos;en obtenir le retrait, en sachant cette information
        inexacte, est puni par la loi.
      </p>
    </LegalPage>
  );
}
