import type { MetadataRoute } from 'next';

/** Installable site (Android « Installer l'application », iOS « Sur l'écran d'accueil »): full screen, black system bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SAKURA',
    short_name: 'SAKURA',
    description: 'Catalogue d’animes, suivi de visionnage et lecteur sans publicité.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['entertainment', 'video'],
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
