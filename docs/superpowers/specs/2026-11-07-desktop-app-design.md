# SAKURA Desktop — étape 1 : l'enveloppe (fenêtre, connexion, mises à jour)

Date : 7 novembre 2026 · Statut : en attente de validation

## Pourquoi

Le site couvre déjà le catalogue, le lecteur, le suivi et les profils. L'app desktop sert à ce que le
site ne peut pas faire seul : **statut Discord, téléchargements hors-ligne, notifications de sortie**,
et une app « installée » qui se met à jour toute seule. Le lecteur actuel est conservé (pas de mpv).

Feuille de route (une étape = une conception + un plan + une livraison) :

1. **Enveloppe** (ce document) : fenêtre qui charge le site, connexion Discord/Google, mises à jour,
   barre des tâches, publication Windows + Linux.
2. Statut Discord (Rich Presence depuis Rust).
3. Notifications de sortie des animes de « Ma liste », même fenêtre fermée.
4. Téléchargements et mode hors-ligne (site mis en cache + vidéos lues depuis le disque).

## Approches considérées

- **A. L'app charge le site en ligne ; Rust ajoute le natif (retenue).** Une seule base de code ; toute
  évolution du site arrive dans l'app immédiatement ; profils SSR et routes serveur inchangés.
  Coût : le hors-ligne (étape 4) passera par une mise en cache du site.
- **B. Interface embarquée (export statique), routes serveur sur Vercel.** Hors-ligne naturel, mais il
  faut scinder le site, ouvrir le CORS, gérer les profils à part, et republier l'app à chaque changement
  d'interface. Écartée.

## Objectifs (étape 1)

- Fenêtre SAKURA qui affiche `https://sakura.thefoxy.me` (prod) ou `http://localhost:3000` (dev).
- Connexion Discord et Google qui fonctionne (Google refuse les webviews intégrées).
- Mises à jour automatiques de l'enveloppe Rust.
- Fermer la fenêtre = réduire dans la barre des tâches (zone de notification) ; quitter depuis le menu.
- Une seule instance ; taille/position de la fenêtre mémorisées ; option « Lancer au démarrage » (désactivée par défaut).
- Builds publiés pour **Windows** (`.exe` NSIS + `.msi`) et **Linux** (AppImage, `.deb`, `.rpm`).

## Non-objectifs

- macOS (pas de compte développeur Apple), mobile.
- Signature de code Windows (alerte SmartScreen « éditeur inconnu » acceptée pour l'instant).
- Barre de titre personnalisée : on garde les décorations natives du système.
- Discord, notifications, téléchargements : étapes 2 à 4.

## Anti-objectifs

- Exposer des commandes Rust à n'importe quelle page : seul le domaine SAKURA (et localhost en dev) a accès au pont.
- Casser le site web : tout le code « app » est inactif hors de l'app.
- Une connexion qui reste coincée dans le navigateur sans revenir à l'app.

## Conception

### Chargement du site

- La fenêtre principale (`main`, 1280×800, min 960×600) est créée en Rust avec une URL externe :
  prod `https://sakura.thefoxy.me`, dev `http://localhost:3000` (`cfg!(debug_assertions)`).
- `build.frontendDist` pointe vers un petit dossier local `src-tauri/offline/` (une page « Pas de
  connexion » avec un bouton Réessayer). Au lancement, Rust teste l'accès au site (requête courte,
  délai 5 s) : en cas d'échec, la fenêtre ouvre cette page locale ; « Réessayer » relance le test.
  `beforeBuildCommand` ne lance plus `npm run build` (le site est déployé sur Vercel, pas embarqué).
- Le site détecte l'app via `isTauri()` de `@tauri-apps/api/core`. Un module `src/lib/desktop.ts`
  regroupe tous les appels natifs et ne fait rien hors de l'app.

### Accès au pont Rust (sécurité)

- Capability dédiée avec `remote.urls: ["https://sakura.thefoxy.me/*", "http://localhost:3000/*"]`,
  limitée aux permissions nécessaires : deep-link, opener (ouvrir une URL `https:` dans le navigateur),
  autostart, updater, process (relaunch), et les commandes maison de l'app.
- Aucune autre origine (sites tiers, lecteurs embarqués en iframe) n'a accès au pont.

### Connexion Discord / Google

Le webview détient le vérificateur PKCE (localStorage du site dans l'app) ; la connexion se fait dans
le navigateur système puis revient :

1. Dans l'app, `signIn(provider)` appelle `signInWithOAuth` avec `skipBrowserRedirect: true` et
   `redirectTo = https://sakura.thefoxy.me/auth/app?next=…`, puis ouvre l'URL obtenue dans le
   navigateur par défaut (plugin opener). Même chose pour « lier un compte » (`linkIdentity`).
2. `/auth/app` est une **route serveur** (`route.ts`, pas une page React) : elle renvoie une petite page
   HTML « Retournez dans SAKURA » qui redirige vers `sakura://auth/callback?code=…&next=…` (+ un bouton
   si le navigateur bloque la redirection). Aucun client Supabase ne s'exécute dans le navigateur, donc
   personne ne tente d'échanger le code à la place de l'app. Les erreurs OAuth (`error_description`) sont
   transmises telles quelles.
3. L'app reçoit le lien (plugin deep-link, schéma `sakura`), met la fenêtre au premier plan et émet un
   événement vers le webview. `desktop.ts` écoute, appelle `exchangeCodeForSession(code)`, puis suit le
   même chemin que `/auth/callback` (profil → onboarding si pas de pseudo, sinon `next`).
4. Supabase : ajouter `https://sakura.thefoxy.me/auth/app` aux Redirect URLs (action utilisateur).

Single-instance + deep-link : sur Windows et Linux le lien ouvre une 2ᵉ instance ; le plugin
single-instance (feature `deep-link`) la transmet à la première puis la ferme. Sur Linux AppImage,
le schéma est enregistré au lancement (`register_all`) ; `.deb`/`.rpm` l'enregistrent à l'installation.

### Barre des tâches, fenêtre, démarrage

- Icône dans la zone de notification avec menu : Ouvrir SAKURA · Lancer au démarrage (case) · Quitter.
  Clic sur l'icône = afficher/masquer.
- Fermer la fenêtre la masque (`prevent_close`) ; la 1ʳᵉ fois, une notification système explique
  « SAKURA reste dans la barre des tâches ».
- Plugin window-state : taille, position, maximisé.
- Plugin autostart (désactivé par défaut) ; la case est aussi dans Paramètres du site, section « Application »,
  visible uniquement dans l'app.

### Mises à jour

- Plugin updater, endpoint `https://github.com/Julien0ff/Sakura/releases/latest/download/latest.json`,
  artefacts signés (clé Tauri ; clé publique dans `tauri.conf.json`, clé privée en secret GitHub).
- Vérification au démarrage puis toutes les 6 h. Si une version existe : toast dans le site
  « Mise à jour 0.x disponible — Redémarrer » ; installation en arrière-plan puis relance.
- Paramètres › Application : version actuelle + « Rechercher une mise à jour ».
- AppImage se met à jour seule ; `.deb`/`.rpm` : l'updater ne gère pas ces formats, la Release reste la
  voie de mise à jour (le toast propose alors d'ouvrir la page de la Release).

### Publication

- Workflow GitHub Actions déclenché par un tag `app-v*` : `tauri-action` sur `windows-latest` et
  `ubuntu-22.04`, Release brouillon avec les installeurs et `latest.json`.
- Version de l'app dans `tauri.conf.json` / `Cargo.toml` (indépendante du site).

## Ce que l'utilisateur doit faire

- Générer la clé de signature (`npx tauri signer generate`) et ajouter `TAURI_SIGNING_PRIVATE_KEY`
  (+ mot de passe) aux secrets du dépôt GitHub.
- Ajouter `https://sakura.thefoxy.me/auth/app` aux Redirect URLs Supabase.
- Publier une Release (pousser un tag `app-v0.1.0`) — rien n'est commité ni poussé par Claude.

## Laissé au constructeur

- Détail du HTML de `/auth/app` et de la page hors-ligne (style SAKURA).
- Nom exact des commandes Rust et des événements, découpage des modules Rust.
- Icône de la zone de notification (dérivée de `icons/`).

## Choix faits par Claude (à vérifier)

- Fenêtre 1280×800, décorations natives.
- Fermer = réduire dans la barre des tâches, avec notification la 1ʳᵉ fois.
- Vérification de mise à jour toutes les 6 h, proposée par un toast (pas de relance forcée).
- `.rpm` ajouté aux formats Linux (Fedora/openSUSE) ; Arch via l'AppImage.
- Tags `app-v*` pour séparer les versions de l'app de celles du site.
