/**
 * Release notes shown once per release (newest first). To publish one: add an entry at the top.
 * `beta: true` on a release or on a single line marks it as a beta feature (badge + icon).
 */
export interface ChangelogLine {
  text: string;
  beta?: boolean;
}

export interface ChangelogEntry {
  /** Unique, sortable id (date-based). The popup reappears whenever the newest id changes. */
  id: string;
  date: string;
  title: string;
  /** Header art (public path or URL). */
  banner: string;
  beta?: boolean;
  features: ChangelogLine[];
  fixes: ChangelogLine[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-11-07-app',
    date: '7 novembre 2026',
    title: 'L’application SAKURA',
    banner: '/banner-news.png',
    features: [
      { text: 'Application pour Windows et Linux : à télécharger depuis le menu de votre profil › Application.' },
      { text: 'Statut Discord « Regarde <anime> · Épisode 12 » pendant la lecture.' },
      { text: 'Notifications de sortie des animes « En cours » et « À voir » de votre liste, même fenêtre fermée.' },
      { text: 'Mises à jour automatiques, lancement au démarrage, icône dans la barre des tâches.' },
      { text: 'Versions mobiles (Android, iPhone) en préparation.', beta: true },
    ],
    fixes: [
      { text: 'Calendrier VF plus rapide (titres reliés côté serveur).' },
      { text: 'Le filtre choisi dans « Ma liste » reste visible sur mobile.' },
    ],
  },
  {
    id: '2026-11-07',
    date: '7 novembre 2026',
    title: 'Comptes, profils et calendrier VF',
    banner: '/banner-news.png',
    features: [
      { text: 'Connexion avec Discord ou Google : votre liste, votre historique et vos réglages vous suivent sur tous vos appareils.' },
      { text: 'Profil public ou privé à partager (sakura.thefoxy.me/pseudo), avec bannière et blocs au choix.' },
      { text: 'Suivi façon Trakt : statut par anime (en cours, terminé, en pause…), note sur 10 et note par épisode.' },
      { text: 'Bannières à débloquer en terminant un anime, et trophées pour les plus célèbres.', beta: true },
      { text: 'Calendrier : sorties VF en plus de la VOSTFR, avec un filtre Tout / VOSTFR / VF.' },
      { text: 'Réglage « Affichage des épisodes » : cartes, liste ou automatique.' },
      { text: 'Nouvelles icônes (Papicons) et animations d’ouverture / fermeture des fenêtres.' },
    ],
    fixes: [
      { text: 'Le trait qui clignotait en bas de la bannière sur mobile.' },
      { text: 'Le carrousel de l’accueil ne se fige plus au passage de la souris.' },
      { text: 'Les rangées de l’accueil vont jusqu’au bord de l’écran.' },
      { text: 'Le bouton de compte ne masque plus les titres sur mobile.' },
      { text: 'Mise en page du profil et de la liste d’épisodes sur grand écran.' },
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0];
export const CHANGELOG_SEEN_KEY = 'sakura-changelog-seen';
