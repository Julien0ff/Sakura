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
    id: '2026-11-11',
    date: '11 novembre 2026',
    title: 'Plein écran en paysage, bannières de dessins animés et webhooks Discord',
    banner: '/banner-news.png',
    features: [
      { text: 'Plein écran en paysage : tournez votre téléphone à l’horizontale pour basculer automatiquement la vidéo en plein écran sans coupure.' },
      { text: 'Nouveau bouton plein écran dans la barre du lecteur pour agrandir ou réduire la vidéo manuellement à tout moment.' },
      { text: 'Dessins animés en bannières : les grands classiques de l’animation rejoignent le carrousel de l’accueil et sont déblocables pour votre profil.' },
      { text: 'Fiches dessins animés : couleur d’ambiance dynamique extraite de l’affiche, harmonisée avec le reste du site.' },
      { text: 'Administration : intégration de webhooks Discord pour les nouveaux épisodes, animes, changelogs, liens utiles et règlement.', beta: true },
      { text: 'Rejoindre la communauté : accès direct au serveur Discord officiel depuis la fenêtre de bienvenue et le menu de profil.' },
      { text: 'Notifications mobiles : test instantané disponible dans Paramètres › Application pour vérifier la réception sur votre téléphone.' },
    ],
    fixes: [
      { text: 'Webhooks Discord : correction de la photo de profil (pfp) de SAKURA et simplification des liens officiels vers la page de téléchargement unique.' },
      { text: 'Sur iPhone et Android, la barre de navigation et le flou du bas s’effacent complètement dès l’ouverture du lecteur.' },
      { text: 'Fin des chargements infinis : si un flux vidéo direct ne démarre pas rapidement, le lecteur passe automatiquement au lecteur suivant.' },
      { text: 'Recherche de sources renforcée : meilleure reconnaissance des titres français (« Les Carnets de l’apothicaire »), des accents et bascule automatique VOSTFR / VF si une langue manque.' },
      { text: 'Optimisation de la résolution des bannières pour un affichage plus rapide sur mobile.' },
    ],
  },
  {
    id: '2026-11-08',
    date: '8 novembre 2026',
    title: 'SAKURA sur Android et iPhone',
    banner: '/banner-news.png',
    features: [
      { text: 'Applications Android et iPhone (via SideStore / AltStore) : à télécharger depuis la page Application.' },
      { text: 'Apps mobiles : notifications de sortie programmées, retours haptiques et mises à jour proposées automatiquement sur Android.' },
      { text: 'Statut Discord dans les apps mobiles : reliez votre compte dans Paramètres › Application.', beta: true },
      { text: 'Lecture dans l’app Android : notification avec commandes et image dans l’image en quittant l’app.', beta: true },
      { text: 'Dessins animés (Gumball, Phinéas et Ferb, Avatar…) : dans la recherche et dans Découvrir › Dessins animés, à regarder comme un anime.' },
      { text: 'Recherche plus tolérante : mots partiels et titres français (« attaque des titans »).' },
      { text: 'Le bouton retour d’une fiche ramène à votre recherche, avec ses résultats.' },
      { text: 'Films, OVA et spéciaux d’un anime à la suite de ses saisons (Saison 1, Saison 2, Film…).' },
      { text: 'Paramètres › Apparence sur téléphone : barre d’onglets avec ou sans les noms, avec aperçu.' },
      { text: 'Connexion Discord ou Google directement depuis le message de bienvenue.' },
    ],
    fixes: [
      { text: 'Les saisons d’un anime ne réapparaissent plus en double dans « Saisons & Relations », et la fiche d’une saison 2 s’ouvre sur la bonne saison.' },
      { text: 'Certains animes (L’Attaque des Titans…) affichaient les épisodes d’un spin-off.' },
      { text: 'Cartes d’épisodes de même hauteur, note alignée avec le titre.' },
      { text: 'Liquid Glass plus clair et plus fidèle, flou plus discret sous la barre d’état et la barre d’onglets.' },
      { text: 'Boutons flottants (profil, calendrier, retour) bien placés sous la barre d’état.' },
      { text: 'Titres des pages en rose, pied de page masqué dans les apps.' },
    ],
  },
  {
    id: '2026-11-07-glass',
    date: '7 novembre 2026',
    title: 'Liquid Glass et statut Discord',
    banner: '/banner-news.png',
    features: [
      { text: 'iPhone : option « Liquid Glass » dans Paramètres › Apparence, fidèle au matériau d’iOS 26.', beta: true },
      { text: 'SAKURA s’installe comme une app : Android « Installer l’application », iPhone « Sur l’écran d’accueil », en plein écran.' },
      { text: 'Lecture : titre de l’épisode, anime et jaquette dans les commandes du téléphone et l’écran verrouillé.' },
      { text: 'App PC : statut Discord avec barre de progression, et la page en cours quand vous ne regardez rien.' },
    ],
    fixes: [
      { text: 'Les effets de verre et de flou s’affichent enfin sur Chrome et Edge.' },
      { text: 'Les pages ne passent plus sous l’encoche en plein écran.' },
      { text: 'Bouton calendrier aligné sur mobile.' },
    ],
  },
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
/** Mobile apps: version whose update was already announced. */
export const CHANGELOG_APP_VERSION_KEY = 'sakura-changelog-app-version';

/**
 * Show « Quoi de neuf » ? New notes since the last visit, or (mobile apps) a new app version since
 * the last launch. Never to first-time visitors: the welcome popup presents everything.
 */
export function changelogDue(s: {
  welcomed: boolean;
  seenId: string | null;
  latestId: string;
  app?: { version: string; seen: string | null };
}): boolean {
  if (!s.welcomed) return false;
  return s.seenId !== s.latestId || (!!s.app && s.app.seen !== s.app.version);
}
