# Comptes SAKURA (Supabase) — conception

Date : 2026-11-06 · Statut : en attente de validation

## Intention

Deux objectifs d'égale importance :
1. **Retrouver ses données partout** : liste, historique, progression et réglages sont synchronisés entre les appareils.
2. **Préparer le social** : pseudo unique, avatar et bannière, puis un profil public partageable (projet 3) et des notes par épisode (projet 4).

Ce document couvre seulement le **socle comptes**. Il comprend la connexion, le pseudo, la synchronisation et la liaison Discord ↔ Google. Le menu avatar, la page de profil et les notes viendront dans les projets suivants. Le schéma est conçu pour les accueillir.

### Objectifs
- Connexion avec Discord ou Google (Supabase Auth, OAuth avec PKCE).
- Pseudo unique choisi au premier login, avec une suggestion tirée du fournisseur.
- Avatar : par défaut celui de Discord ou Google, ou une image uploadée (Supabase Storage).
- Synchronisation dans les deux sens de la liste, de l'historique, de la progression par épisode et des réglages.
- Fusion au premier login : les données locales existantes ne sont jamais perdues.
- Dans les Paramètres, lier ou délier Discord et Google sur le même compte.

### Non-objectifs (pour ce projet)
- Menu avatar, page de profil et bannières (projet 3).
- Statuts « en cours / terminé » et notes (projet 4).
- Connexion dans l'app desktop Tauri (projet 5 ; le code reste côté client pour la permettre).

### Anti-objectifs
- Le site doit rester utilisable **sans compte**, comme aujourd'hui.
- Aucune perte de données à la connexion, à la fusion ou en hors-ligne.
- Aucune donnée d'un utilisateur ne doit être lisible ou modifiable par un autre, sauf ce qu'il rend public plus tard.
- Pas de ralentissement : l'interface lit toujours le stockage local.

## Approches envisagées

| | Approche | Compromis |
|---|---|---|
| **A (retenue)** | Tables Postgres normalisées + RLS, store local en cache, synchro en arrière-plan | Plus de travail initial, mais le profil public, les filtres et les notes s'appuient directement dessus |
| B | Un seul bloc JSON par utilisateur | Rapide, mais impossible à interroger proprement pour le profil public : refonte au projet 3 |
| C (écartée) | Firebase | Discord n'est pas natif (route serveur + Admin SDK) et l'upload d'images exige le forfait Blaze |

Choix de l'utilisateur : **A, sur Supabase**.

## Infrastructure

- Projet Supabase `sakura` (ref `qyebpmhhneszosykkjfj`), région eu-west-3, forfait gratuit.
- Variables d'environnement (publiques, protégées par la RLS) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, à mettre dans `.env.local` et sur Vercel.
- **Actions manuelles de l'utilisateur** (impossibles via l'outil) :
  - Créer une app Discord (Developer Portal) et un client OAuth Google (Cloud Console), avec pour redirect URI `https://qyebpmhhneszosykkjfj.supabase.co/auth/v1/callback`.
  - Coller leurs identifiants dans Supabase > Authentication > Providers.
  - Activer « Manual linking » dans Authentication > Settings.
  - Ajouter aux Redirect URLs : `https://sakura.thefoxy.me/**` et `http://localhost:3000/**`.

## Schéma (schéma `public`)

Toutes les tables ont la RLS activée. `anime_id` est l'identifiant AniList (comme aujourd'hui).

- **profiles**
  - Colonnes : `id uuid pk → auth.users on delete cascade`, `username text unique` (nullable tant que l'onboarding n'est pas fait), `display_name`, `avatar_url`, `banner_id text` (projet 3), `is_public bool default false`, `visibility jsonb default '{}'` (projet 3), `settings jsonb default '{}'`, `created_at`, `updated_at`.
  - Contrainte sur le pseudo : `^[a-z0-9_]{3,20}$`, en minuscules, plus une liste de mots réservés (`settings`, `api`, `auth`, `anime`, `profile`, `discover`, `search`, `history`, `watchlist`, `calendar`, `legal`, `u`, `admin`, `sakura`…). Ils restent disponibles comme URL de profil.
  - Une ligne est créée par un trigger à l'inscription (`username` null, `display_name` et `avatar_url` tirés des métadonnées du fournisseur).
- **watchlist_entries** : `pk (user_id, anime_id)`, `title`, `cover`, `color`, `score`, `status` (statut de diffusion AniList), `added_at`, `updated_at`, `deleted_at` (pierre tombale, pour qu'une suppression se propage aux autres appareils).
- **history_entries** : `pk (user_id, anime_id)`, `title`, `cover`, `color`, `episode_number`, `episode_name`, `season`, `lang`, `watched_at`, `updated_at`, `deleted_at`.
- **episode_progress** : `pk (user_id, anime_id, season, episode)`, `time`, `duration`, `updated_at`.

**Politiques RLS (projet 2)** : le propriétaire peut lire, insérer, modifier et supprimer ses propres lignes (`auth.uid() = user_id`). Personne d'autre n'a accès. Les politiques de lecture publique arriveront au projet 3.

**RPC `username_available(name text) → bool`** (`security definer`) : elle vérifie la disponibilité d'un pseudo sans exposer la table.

**Storage** : bucket `avatars`, en lecture publique, 2 Mo maximum, formats `image/png|jpeg|webp|gif`. L'écriture n'est permise que dans `avatars/<uid>/…`.

## Côté client

- `@supabase/supabase-js` dans le navigateur (pas de `@supabase/ssr`). La session est stockée en localStorage avec le flux PKCE.
  - Pourquoi : la majorité des pages sont des composants client, et l'app desktop ne peut pas utiliser de cookies serveur.
- Page `/auth/callback` : elle échange le code, puis renvoie vers la page d'origine, ou vers l'onboarding si le pseudo n'est pas encore choisi.
- Écran d'onboarding (pseudo) : vérification de disponibilité en direct, pseudo suggéré, avatar affiché.
- Paramètres > Compte :
  - Connexion avec Discord ou Google.
  - Identités liées, avec `linkIdentity` et `unlinkIdentity`. Impossible de délier la dernière identité.
  - Changer d'avatar (upload).
  - Déconnexion.
  - Supprimer le compte (via une RPC qui supprime l'utilisateur ; les données suivent par cascade).

### Moteur de synchronisation
- Le store zustand reste la source que l'interface lit. Ses entrées gagnent un `updatedAt`, et les suppressions de la liste et de l'historique laissent une pierre tombale locale.
- **À la connexion** :
  1. Récupérer toutes les lignes de l'utilisateur.
  2. Fusionner ligne par ligne, la plus récente (`updated_at`) gagnant.
  3. Écrire le résultat dans le store.
  4. Envoyer à Supabase les lignes où la version locale était la plus récente.
- **Ensuite** : l'abonnement au store détecte les lignes modifiées et les envoie par upsert, groupées toutes les ~2 s. La progression de lecture, qui change en continu, est envoyée au plus toutes les 15 s, plus une dernière fois à la pause ou à la fermeture.
- **Retour au premier plan / reconnexion réseau** : on refait une récupération incrémentale (`updated_at > dernière synchro`).
- **Hors-ligne** : les modifications restent dans le store et repartent au retour du réseau.
- **Déconnexion** *(mon choix)* : les données locales du compte sont effacées, pour qu'elles ne restent pas sur un appareil partagé. Elles reviennent à la prochaine connexion.

## Laissé au constructeur
- Découpage des fichiers (`src/lib/supabase.ts`, `src/core/sync/*`).
- Style de l'onboarding et du bloc Compte, dans la lignée de la page Paramètres (listes groupées style iOS).
- Format exact de l'upload d'avatar : recadrage carré et compression côté client recommandés.

## Vérifications
- Advisors de sécurité Supabase sans alerte après les migrations.
- Test manuel :
  1. Données locales.
  2. Connexion → fusion OK.
  3. Second navigateur → données présentes.
  4. Suppression → propagée.
- Test RLS : un deuxième utilisateur ne voit aucune ligne du premier.
