# Anime Premium

Application de streaming d'animes pensée pour le confort : un catalogue riche, un suivi de visionnage qui se souvient de tout, et un lecteur sans friction. Web (Next.js) et desktop (Tauri).

> Le projet n'héberge aucune vidéo. Les métadonnées viennent d'[AniList](https://anilist.co) et de [TMDB](https://www.themoviedb.org) ; les horaires d'opening/ending d'[AniSkip](https://aniskip.com).

## Fonctionnalités

**Catalogue et découverte**
- Accueil avec bannière à la une (carrousel, swipe, parallaxe), tendances, saison en cours, populaires, mieux notés
- Recherche instantanée, exploration par genre et tri, pagination
- Calendrier des sorties de la semaine, les animes de « Ma liste » en premier
- Fiches complètes : titres et synopsis en français (TMDB), saisons, épisodes avec vignettes, bande-annonce, relations

**Suivi**
- « Ma liste », historique, ligne « Reprendre » sur l'accueil
- Position de lecture mémorisée par épisode, barre de progression et badge « Vu » sur chaque épisode
- Bouton « Reprendre · Ép. N » sur la fiche
- Tout est stocké localement (localStorage), rien n'est envoyé à un serveur

**Lecteur**
- Plyr + HLS.js, choix de la qualité et de la vitesse
- « Passer l'opening / l'ending » avec les horaires communautaires AniSkip (option : saut automatique)
- Épisode suivant automatique avec compte à rebours annulable
- Interface qui s'efface pendant la lecture, fermeture avec Échap

**Interface**
- Couleur ambiante dynamique : chaque anime teinte la page de sa couleur dominante, qui évolue au scroll
- Barre d'onglets flottante sur mobile, barre latérale sur desktop
- Respect de `prefers-reduced-motion`, `prefers-reduced-transparency` et des zones sûres (encoche, barre d'accueil)

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · TanStack Query · Zustand · Plyr · HLS.js · Tauri 2

## Démarrage

Prérequis : Node.js 20+ (et [Rust](https://rustup.rs) pour la version desktop).

```bash
npm install
cp .env.example .env.local   # puis renseigner TMDB_READ_TOKEN
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `TMDB_READ_TOKEN` | « API Read Access Token » TMDB ([réglages API](https://www.themoviedb.org/settings/api)). Utilisé uniquement côté serveur par le proxy `/api/tmdb`, jamais envoyé au navigateur. |

### Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | ESLint |
| `npx tauri dev` | Version desktop en développement (lance `npm run dev`) |

## Structure

```
src/
├── app/                  Routes (App Router)
│   ├── page.tsx          Accueil
│   ├── anime/            Fiche + lecteur
│   ├── search/ discover/ calendar/ watchlist/ history/ settings/
│   └── api/
│       ├── tmdb/         Proxy TMDB (ajoute le token côté serveur)
│       └── scraper/      Résolution des sources vidéo
├── components/
│   ├── anime/            Cartes et grilles
│   ├── home/             Bannière, lignes horizontales
│   ├── layout/           Barre latérale, barre d'onglets mobile, layout
│   └── player/           Lecteur (Plyr/HLS) et calque plein écran
├── core/
│   ├── api/              Clients AniList, TMDB, AniSkip
│   └── store.ts          État persistant (liste, historique, progression, réglages)
├── lib/                  Utilitaires (formatage, couleur ambiante)
└── scrapers/             Modules de sources vidéo
src-tauri/                Application desktop (Rust)
```

## Limites connues

- **Build desktop** : `tauri.conf.json` attend un export statique (`out/`), incompatible avec les routes API (`/api/tmdb`, `/api/scraper`). Il faut soit embarquer un serveur Next.js dans l'app, soit déplacer ces appels dans des commandes Rust.
- **Sources vidéo** : leur disponibilité dépend de services tiers et peut varier.
- **AniSkip** n'est utilisé que pour la saison 1 / les séries à saison unique : la numérotation des saisons TMDB ne correspond pas toujours aux entrées AniList/MyAnimeList.

## Licence

À définir.
