/**
 * Informations légales du site — À COMPLÉTER avant toute mise en ligne.
 * Elles alimentent le footer et les pages /legal/*.
 * (LCEN, art. 6 III : identité de l'éditeur, directeur de la publication, hébergeur.)
 */
export const siteConfig = {
  name: 'SAKURA',
  url: 'https://sakura.thefoxy.me', // TODO: domaine définitif
  updatedAt: '6 novembre 2026',
  license: 'GPL-3.0-or-later',
  licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',

  editor: {
    // Personne physique : nom + prénom (un éditeur non professionnel peut ne publier
    // que l'hébergeur et garder son identité chez lui, cf. LCEN art. 6 III-2).
    name: 'Foxy',
    status: 'Particulier',
    publicationDirector: 'Foxy',
  },

  host: {
    name: 'Vercel Inc.',
    address: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    contact: 'https://vercel.com/contact',
  },

  /** Adresse dédiée aux signalements de contenus (LCEN art. 6 I-5). */
  abuseEmail: '[À compléter : signalement@exemple.fr]',
} as const;

export const legalLinks = [
  { href: '/legal/mentions-legales', label: 'Mentions légales' },
  { href: '/legal/confidentialite', label: 'Confidentialité' },
  { href: '/legal/cgu', label: 'Conditions d’utilisation' },
  { href: '/legal/signalement', label: 'Signaler un contenu' },
] as const;
