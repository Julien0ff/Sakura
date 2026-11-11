<p align="center">
  <img src="public/banner.png" alt="SAKURA" width="100%" />
</p>

<p align="center">
  <strong>Vos animes, sans publicité, avec un suivi qui se souvient de tout.</strong><br />
  Catalogue · Suivi de visionnage · Lecteur — Web et desktop
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licence GPL-3.0" src="https://img.shields.io/badge/licence-GPL--3.0-ff7aa8?style=flat-square" /></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24c8db?style=flat-square&logo=tauri&logoColor=white" />
  <img alt="Hébergé sur Vercel" src="https://img.shields.io/badge/h%C3%A9berg%C3%A9%20sur-Vercel-000?style=flat-square&logo=vercel" />
</p>

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack](#stack)
- [Démarrage](#démarrage)
- [Déploiement (Vercel)](#déploiement-vercel)
- [Version desktop (Tauri)](#version-desktop-tauri)
- [Structure](#structure)
- [Identité visuelle](#identité-visuelle)
- [Limites connues](#limites-connues)
- [Crédits](#crédits)
- [Licence](#licence)

## Fonctionnalités

> SAKURA n'héberge aucune vidéo. Les métadonnées viennent d'[AniList](https://anilist.co) et de [TMDB](https://www.themoviedb.org), les horaires d'opening/ending d'[AniSkip](https://aniskip.com).

**Catalogue et découverte**
- Accueil avec bannière à la une : carrousel, swipe, parallaxe
- Lignes Tendances, Saison en cours, Populaires, Mieux notés
- Recherche instantanée, exploration par genre et par tri
- Calendrier des sorties de la semaine, avec vos séries en premier
- Fiches complètes : titres et synopsis en français, saisons, épisodes illustrés, bande-annonce, œuvres liées

**Suivi**
- Ma liste, Historique, ligne « Reprendre » sur l'accueil
- Position de lecture mémorisée pour chaque épisode, barre de progression et badge « Vu »
- Bouton « Reprendre · Ép. N » sur chaque fiche
- Statuts (À voir, En cours, En pause, Terminé, Abandonné) et notes de 1 à 10 par anime et par épisode ; « En cours » et « Terminé » se posent tout seuls
- Profil partageable `sakura.thefoxy.me/<pseudo>` (privé par défaut) : blocs à afficher et à ordonner, bannière par défaut ou débloquée en terminant un anime sur SAKURA, trophées 🏆 pour les plus populaires
- Compte facultatif (Discord ou Google, via Supabase) : liste, historique, progression et réglages synchronisés entre appareils ; comptes Discord et Google liables
- Sans compte : tout reste sur l'appareil (localStorage), aucun cookie

**Lecteur**
- Plyr + HLS.js, choix de la qualité et de la vitesse
- « Passer l'opening / l'ending » grâce aux horaires AniSkip, en un clic ou automatiquement
- Épisode suivant automatique, avec un compte à rebours qu'on peut annuler
- Interface qui s'efface pendant la lecture, fermeture avec Échap

**Interface**
- Couleur ambiante : chaque anime teinte la page de sa couleur dominante, qui se fond au scroll
- Animations de scroll calculées par le navigateur (CSS scroll-driven animations), sans JavaScript
- Barre d'onglets flottante sur mobile, barre latérale sur desktop
- Prend en compte la réduction des animations et de la transparence, ainsi que l'encoche et la barre d'accueil des téléphones

## Stack

| Domaine | Outils |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Style | Tailwind CSS 4 |
| Données | TanStack Query, Zustand (état persistant) |
| Lecteur | Plyr, HLS.js |
| Desktop | Tauri 2 (Rust) |
| APIs | AniList (GraphQL), TMDB (via un proxy serveur), AniSkip |

## Démarrage

Prérequis : Node.js 20 ou plus récent.

```bash
git clone <url-du-depot> sakura
cd sakura
npm install
cp .env.example .env.local   # puis renseigner TMDB_READ_TOKEN
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `TMDB_READ_TOKEN` | « API Read Access Token » TMDB ([réglages API](https://www.themoviedb.org/settings/api)). Il n'est utilisé que côté serveur par le proxy `/api/tmdb` et n'est jamais envoyé au navigateur. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Projet Supabase des comptes (facultatif : sans elles, le site fonctionne sans comptes). Clés publiques ; les données sont protégées par les règles RLS de `supabase/migrations/`. |

### Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` puis `npm start` | Build et serveur de production |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (synchro, pseudos) avec `node --test` |
| `npx tauri dev` | Version desktop en développement |

## Déploiement (Vercel)

SAKURA est hébergé sur [Vercel](https://vercel.com).

1. Importer le dépôt dans Vercel (le framework Next.js est détecté automatiquement).
2. Dans *Settings → Environment Variables*, ajouter `TMDB_READ_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Déployer. Chaque push sur `main` déclenche ensuite un déploiement de production, et chaque pull request un aperçu.

Avant la mise en ligne publique, complétez les informations légales dans [`src/lib/site-config.ts`](src/lib/site-config.ts) : éditeur, contact et adresse de signalement. Elles alimentent le footer et les pages `/legal/*`.

## Version desktop (Tauri)

L'app desktop (Windows, Linux) affiche le site en ligne (`https://sakura.thefoxy.me`) dans une fenêtre native et ajoute : connexion Discord / Google via le navigateur, statut Discord « Regarde … » pendant la lecture, notifications de sortie des animes suivis (même fenêtre fermée), icône dans la barre des tâches (fermer = réduire), lancement au démarrage, mises à jour automatiques. Réglages dans Paramètres › Application. Hors connexion, elle affiche une page « Pas de connexion ».

Prérequis : [Rust](https://rustup.rs) et les dépendances système de Tauri (sous Linux : `webkit2gtk-4.1`, `libappindicator-gtk3`).

```bash
npm run dev                                                     # le site (localhost:3000)
npm run tauri:dev                                               # « SAKURA Dev », branchée sur le site local
```

L'app de dev a son propre identifiant : elle ne se mélange pas avec l'app installée et ne prend pas le lien `sakura://` (la connexion se teste donc avec l'app compilée).

**Connexion dans l'app** : le fournisseur s'ouvre dans le navigateur, revient sur `/auth/app`, qui renvoie vers `sakura://auth/callback` ; l'app termine la connexion. Ajoutez dans Supabase › Authentication › URL Configuration › Redirect URLs :
`https://sakura.thefoxy.me/auth/app**` et `http://localhost:3000/auth/app**` (le `**` laisse passer le `?next=`).

**Publier une version** :

1. Une seule fois : `npx tauri signer generate -w ~/.tauri/sakura.key`, mettez la clé publique dans `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) et ajoutez aux secrets du dépôt GitHub `TAURI_SIGNING_PRIVATE_KEY` (contenu de `~/.tauri/sakura.key`) et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
2. Montez la version dans `src-tauri/tauri.conf.json` et `src-tauri/Cargo.toml`.
3. `git tag app-v0.1.0 && git push origin app-v0.1.0` : GitHub Actions compile Windows (`.exe`, `.msi`) et Linux (AppImage, `.deb`, `.rpm`) dans une Release brouillon. Publiez-la : les apps installées la proposent au prochain contrôle (au démarrage puis toutes les 6 h). Les installations `.deb` / `.rpm` sont renvoyées vers la page de la Release.

## Apps mobiles (Android, iPhone)

Même projet Tauri que l'app desktop. Les projets natifs (`src-tauri/gen/android`, `src-tauri/gen/apple`) sont générés par GitHub Actions (`.github/workflows/mobile-release.yml`) à chaque release `app-v*`, qui ajoute à la release :

- `SAKURA_<version>_android.apk` (signé avec la clé du projet) ;
- `SAKURA_<version>_ios.ipa` (non signé : à installer avec AltStore ou SideStore, qui le signent avec un compte Apple gratuit).

**Clé Android (une seule fois, à conserver : sans elle aucune mise à jour n'est acceptée par Android)** :

```bash
keytool -genkeypair -v -keystore ~/sakura-android.jks -alias sakura -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 ~/sakura-android.jks   # → secret ANDROID_KEYSTORE_BASE64
```

Secrets GitHub : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS` (`sakura`), `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD`.

Compiler Android en local demande le NDK Android et Java 17 ou 21 (`npx tauri android init`, puis `npx tauri android dev`). iPhone : uniquement sur macOS (Xcode).

## Structure

```
src/
├── app/                    Routes (App Router)
│   ├── page.tsx            Accueil
│   ├── anime/              Fiche + lecteur
│   ├── search/ discover/ calendar/ watchlist/ history/ settings/
│   ├── legal/              Mentions légales, confidentialité, CGU, signalement
│   └── api/
│       ├── tmdb/           Proxy TMDB (ajoute le token côté serveur)
│       └── scraper/        Résolution des sources vidéo
├── components/
│   ├── anime/              Cartes et grilles
│   ├── home/               Bannière, lignes horizontales
│   ├── layout/             Barre latérale, onglets mobiles, footer, popup de bienvenue
│   ├── legal/              Mise en page des pages légales
│   └── player/             Lecteur (Plyr/HLS) et calque plein écran
├── core/
│   ├── api/                Clients AniList, TMDB, AniSkip
│   └── store.ts            Liste, historique, progression, réglages
├── lib/                    Utilitaires, couleur ambiante, config du site
└── scrapers/               Modules de sources vidéo
public/                     Logo, icône, bannière
src-tauri/                  Application desktop (Rust)
```

## Identité visuelle

Les fichiers sont dans [`public/`](public/) et [`src-tauri/icons/ios/source/`](src-tauri/icons/ios/source/).

| Fichier | Aperçu | Usage |
| --- | --- | --- |
| [`icon.png`](public/icon.png) — 512 × 512 | <img src="public/icon.png" alt="Icône SAKURA" width="64" /> | Icône du site, favicon, barre latérale, footer |
| [`icon-app-dark.png`](src-tauri/icons/ios/source/icon-4096-dark.png) — 4096 × 4096 | <img src="src-tauri/icons/ios/source/icon-4096-dark.png" alt="Icône SAKURA" width="64" /> | Icône de l'app iOS et Android en dark mode |
| [`icon-app-normal.png`](src-tauri/icons/ios/source/icon-4096.png) — 4096 × 4096 | <img src="src-tauri/icons/ios/source/icon-4096.png" alt="Icône SAKURA" width="64" /> | Icône de l'app iOS et Android en normal et white mode |
| [`text.png`](public/text.png) — 1500 × 500 | <img src="public/text.png" alt="Logotype SAKURA" width="220" /> | Logotype seul, fond transparent |
| [`banner.png`](public/banner.png) — 1500 × 500 | <img src="public/banner.png" alt="Bannière SAKURA" width="220" /> | Bannière : README, popup de bienvenue, partage sur les réseaux (Open Graph) |
| [`banner-news.png`](public/banner-news.png) — 1500 × 500 | <img src="public/banner-news.png" alt="Bannière SAKURA" width="220" /> | Bannière : page du popup des changelogs |

Couleur principale : rose sakura `#FF7AA8`.

## Limites connues

- **App desktop** : non signée pour l'instant (Windows SmartScreen affiche « éditeur inconnu ») ; pas de version macOS.
- **Sources vidéo** : leur disponibilité dépend de services tiers et peut varier.
- **AniSkip** n'est utilisé que pour la saison 1 et les séries à saison unique, car la numérotation des saisons de TMDB ne correspond pas toujours aux entrées AniList/MyAnimeList.

## Crédits

- Métadonnées : [AniList](https://anilist.co) et [The Movie Database](https://www.themoviedb.org). *Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.*
- Horaires d'opening et d'ending : [AniSkip](https://aniskip.com)
- Les titres, visuels et marques des œuvres appartiennent à leurs ayants droit respectifs.

## Licence

SAKURA est un logiciel libre distribué sous licence **GNU General Public License v3.0 ou ultérieure** ([`GPL-3.0-or-later`](LICENSE)).

Vous pouvez l'utiliser, l'étudier, le modifier et le redistribuer. Toute version modifiée que vous distribuez doit rester sous la même licence et fournir son code source. Le texte complet est dans le fichier [`LICENSE`](LICENSE).
