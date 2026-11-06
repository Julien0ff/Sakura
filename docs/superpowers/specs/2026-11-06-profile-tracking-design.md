# Profil et suivi — conception

Date : 2026-11-06 · Statut : en attente de validation · Fusion des anciens projets 3 (avatar, menu, profil) et 4 (statuts, notes)

## Intention

Les comptes existent : synchro, pseudo, avatar (spec `2026-11-06-accounts-design.md`). Ce projet ajoute le côté **social et suivi**, à la Trakt/AniList :
- chaque anime suivi a un **statut** et une **note** ; chaque épisode peut être noté ;
- chaque utilisateur a une **page de profil partageable** (`sakura.thefoxy.me/<pseudo>`), qu'il compose lui-même à partir de son suivi ;
- les **bannières** de profil se débloquent en terminant des animes sur SAKURA, et les animes connus donnent en plus un trophée.

L'utilisateur personnalise ce que son profil montre.

### Objectifs
1. **Statuts** : À voir, En cours, En pause, Terminé, Abandonné.
   - Ils se posent à la main.
   - « En cours » se pose automatiquement quand un premier épisode est **vu** (> 90 %), et non au simple lancement, pour ne pas remplir la liste avec les animes essayés.
     - Si l'anime n'est pas dans la liste, il y est ajouté.
     - S'il est déjà Terminé ou Abandonné, le statut ne change pas.
   - « Terminé » se pose automatiquement au dernier épisode vu sur SAKURA.
2. **Notes** de 1 à 10 : une par anime, une par épisode.
3. **« Ma liste » devient le suivi** :
   - Le bouton de la fiche ouvre un choix de statut (et le retrait de la liste).
   - La page Ma liste a des filtres par statut.
   - Les entrées existantes migrent en « À voir ».
4. **Avatar et menu**
   - L'avatar (ou une icône de connexion) remplace le ⚙️ : en haut à droite sur mobile, en bas de la barre latérale sur desktop.
   - Connecté, le menu propose : Mon profil, Partager mon profil, Paramètres, Déconnexion.
   - Déconnecté, il propose : Se connecter avec Discord ou Google, Paramètres.
5. **Page profil `/<pseudo>`**, rendue côté serveur, avec un aperçu propre quand le lien est partagé (Discord, etc.).
   - Mise en page validée : vitrine verticale A, avec l'en-tête de B (bannière, avatar à gauche, pseudo à côté).
   - Puis les chiffres clés, puis les blocs dans l'ordre choisi.
6. **« Modifier le profil »** (propriétaire uniquement) :
   - profil public ou privé ;
   - blocs affichés, masqués et réordonnés ;
   - choix de la bannière.
7. **Bannières**
   - 4 bannières libres pour tous.
   - Tout anime **terminé automatiquement sur SAKURA** débloque sa bannière AniList (s'il en a une).
   - Les animes « connus » donnent en plus un **trophée 🏆**.
   - Sélecteur : les bannières débloquées d'abord, puis celles à débloquer en grisé avec la progression (maquette validée).

### Non-objectifs
- Changer de pseudo (plus tard).
- Suivre d'autres utilisateurs, flux d'activité entre amis, commentaires.
- Statut d'activité Discord, app desktop (projet suivant).
- Importer depuis AniList ou MyAnimeList.

### Anti-objectifs
- Un profil ne doit **jamais** exposer ce que son propriétaire n'a pas coché, ni quoi que ce soit s'il est privé.
- Pas de régression pour les visiteurs sans compte : le suivi (statuts, notes) marche aussi en local, sans compte, comme Ma liste aujourd'hui. Seuls le profil et les bannières demandent un compte.
- Le lecteur ne doit pas être gêné : noter en fin d'épisode ne bloque jamais l'épisode suivant automatique.

## Décisions prises avec l'utilisateur
- Fusion des projets 3 et 4.
- « Terminé » : option C.
  - Le statut peut être posé à la main ; il est posé automatiquement au dernier épisode vu sur SAKURA.
  - **Seul le passage automatique débloque la bannière.**
  - Le profil peut afficher « vu sur SAKURA ».
- « Ma liste » = le suivi (option A).
- Mise en page du profil : A avec l'en-tête de B ; menu avatar et sélecteur de bannière conformes aux maquettes (`.superpowers/brainstorm/…/menu-banners.html`).
- 4 bannières par défaut ; les animes connus donnent un trophée, les autres débloquent seulement la bannière.
- Profils publics servis par une **fonction Postgres qui renvoie un profil déjà filtré** (approche 1 ci-dessous).

## Approches (service des profils publics)

| | Approche | Compromis |
|---|---|---|
| **1 (retenue)** | RPC `get_public_profile(username)` en `security definer` : vérifie `is_public` et ne renvoie que les blocs cochés, sous forme de JSON | La règle de visibilité tient en un seul endroit et se teste en SQL ; les tables restent fermées |
| 2 | Politiques RLS de lecture publique sur chaque table | Règle dupliquée ; une colonne ajoutée plus tard devient publique par défaut |
| 3 | Route serveur avec la clé secrète Supabase | Une clé qui contourne la RLS vit sur Vercel ; inutile |

## Choix techniques (mes choix, à relire)
- **Statut et notes dans `watchlist_entries`**
  - Nouvelles colonnes :
    - `list_status text` (`planned | watching | paused | completed | dropped`),
    - `rating smallint` (1–10, nullable),
    - `completed_on_sakura_at timestamptz` (nullable),
    - `favorite boolean default false`.
  - Le store local étend `SavedAnime` de la même façon. La synchro existante (dernière écriture gagne par ligne) couvre ces champs sans changement de logique.
- **Notes d'épisodes** : nouvelle table `episode_ratings`
  - Colonnes : `(user_id, anime_id, season, episode)` en PK, `rating`, `updated_at`, `deleted_at`, `synced_at`.
  - Dans le store : nouvelle tranche `episodeRatings`, avec des clés `r:<anime>:<season>:<ep>` dans la synchro.
- **Bannières débloquées** : nouvelle table `unlocked_banners(user_id, anime_id, banner_url, is_trophy, unlocked_at)`.
  - Elle est écrite par le client au passage automatique à Terminé (on fait confiance au client, choix accepté).
  - Ajout seulement : aucune suppression si l'utilisateur change ensuite de statut.
  - `profiles.banner_id` contient soit `default:<1-4>`, soit `anime:<anilistId>`. La RPC n'accepte de choisir qu'une bannière par défaut ou débloquée (vérification dans `set_banner(banner_id)`).
- **Règle « terminé automatiquement »** : l'anime (entrée AniList) a le statut AniList `FINISHED`, et le dernier épisode de la dernière saison TMDB dépasse 90 % de visionnage (`isWatched`). La saison 0 (« Épisodes spéciaux ») est ignorée.
  - Cette vérification se fait au moment où l'épisode passe « vu », dans la fiche.
  - Un anime en cours de diffusion ne passe jamais Terminé automatiquement.
- **Trophée** : un anime est « connu » si sa popularité AniList dépasse 150 000, ou s'il figure dans `src/lib/trophies.ts` (`TROPHY_OVERRIDES: { include: number[]; exclude: number[] }`). Le calcul se fait au déblocage et est stocké dans `is_trophy`.
- **Bannières par défaut** : 4 images libres de droits ou maison dans `public/banners/` (à fournir par l'utilisateur ; des dégradés SAKURA servent de remplaçants en attendant).
- **Blocs du profil** (`profiles.visibility` jsonb) :
  - Format : `{ blocks: [{ id, visible }] }` dans l'ordre.
  - Blocs : `stats`, `favorite`, `watching`, `completed`, `top_rated`, `episode_ratings`, `planned`.
  - Défaut : tout visible sauf `planned`, dans cet ordre.
  - Le profil est privé par défaut (`is_public = false`, déjà en place).
- **`get_public_profile(name text) returns jsonb`**
  - Renvoie `null` si le profil n'existe pas ou est privé (la page affiche alors « Ce profil est privé ou n'existe pas », sans distinguer les deux cas).
  - Sinon : `username`, `display_name`, `avatar_url`, la bannière résolue, `created_at`, la liste des trophées, puis **uniquement** les blocs visibles.
  - Chaque bloc est limité à 20 éléments et ne contient que titre, couverture, couleur, statut, note et numéro d'épisode : jamais de positions de lecture ni de lignes supprimées.
  - Le propriétaire voit son propre profil par la même RPC (avec ses données privées, via `auth.uid() = id`) plus un bouton « Modifier ».
- **Route** : `src/app/[username]/page.tsx`
  - Server Component dynamique, avec `generateMetadata` (titre, description, `og:image` = bannière résolue).
  - Appel à la RPC avec la clé publiable.
  - Les pseudos réservés ne tombent jamais sur cette route : les routes statiques passent avant, et la liste réservée est déjà en base.
  - Conséquence pour l'app desktop : elle chargera le site en ligne (pas d'export statique), ce qui lui donne aussi les mises à jour automatiques.
- **Partager mon profil** : `navigator.share` si disponible, sinon copie du lien avec une confirmation.
- **Statistiques** : nombre de terminés, d'en cours, d'heures visionnées (somme de `episode_progress.time`), note moyenne. Calculées dans la RPC.
- **UI des notes**
  - Fiche anime : un sélecteur 1–10 (étoiles ou pastilles) à côté du statut, et une note par épisode dans la liste.
  - Lecteur : une petite invite « Noter cet épisode » dans les dernières secondes, qui disparaît d'elle-même et n'interrompt pas le compte à rebours de l'épisode suivant.

## Laissé au constructeur
- Découpage des composants, rendu exact du sélecteur de note (pastilles ou étoiles), animations.
- Glisser-déposer ou boutons ↑↓ pour réordonner les blocs (les boutons suffisent sur mobile).
- Mise en cache de la page profil (revalidation courte, ~60 s, acceptable).

## Vérifications
- Tests SQL de `get_public_profile` :
  1. Profil privé → `null`.
  2. Profil public → seuls les blocs visibles sont présents.
  3. Aucun champ `time`, `duration` ni ligne `deleted_at` dans le JSON.
  4. `set_banner` refuse une bannière non débloquée.
- Tests unitaires :
  - règle « terminé automatiquement » (anime en diffusion : non ; dernier épisode à 89 % : non ; à 90 % : oui) ;
  - migration Ma liste → « À voir » ;
  - fusion des nouvelles clés de synchro.
- Navigateur :
  - menu avatar sur mobile et desktop ;
  - profil public et privé ;
  - aperçu `og:` visible dans le HTML ;
  - sélecteur de bannière.
