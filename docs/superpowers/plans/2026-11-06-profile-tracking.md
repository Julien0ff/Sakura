# Profil et suivi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statuts et notes (anime et épisodes), Ma liste = suivi, menu avatar, page de profil publique personnalisable en `/<pseudo>`, bannières débloquables avec trophées.

**Architecture:**
- Le suivi étend le store local et la synchro existante : nouvelles colonnes sur `watchlist_entries` et nouvelle table `episode_ratings`, avec la même fusion « dernière écriture gagne ».
- Les profils publics sont servis par une RPC Postgres `get_public_profile`, qui renvoie un JSON déjà filtré. Elle est appelée par un Server Component dynamique `src/app/[username]/page.tsx`, avec `generateMetadata` pour les aperçus.
- Les bannières débloquées sont écrites par le client dans `unlocked_banners`. Le choix de bannière passe par une RPC qui vérifie le déblocage.

**Tech Stack:** Next.js 16 (App Router), React 19, zustand 5, `@supabase/supabase-js` v2, Supabase Postgres 17, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-06-profile-tracking-design.md` (et `2026-11-06-accounts-design.md` pour la synchro).

## Global Constraints

- Projet Supabase `qyebpmhhneszosykkjfj`. Chaque migration est versionnée dans `supabase/migrations/`, puis `src/lib/database.types.ts` est mis à jour à la main.
- Statuts : `planned | watching | paused | completed | dropped`, libellés « À voir, En cours, En pause, Terminé, Abandonné ».
- Notes : entiers de 1 à 10.
- Blocs de profil, dans l'ordre par défaut : `stats, favorite, watching, completed, top_rated, episode_ratings, planned`. Tous visibles sauf `planned`.
- Bannières : `banner_id` = `default:1` … `default:4` ou `anime:<anilistId>`. La valeur par défaut est `default:1`.
- Trophée : popularité AniList ≥ 150 000, ou présence dans `TROPHY_OVERRIDES.include`, et absence de `TROPHY_OVERRIDES.exclude`.
- « Terminé » automatique : statut AniList `FINISHED` + dernier épisode de la dernière saison TMDB > 90 % (`isWatched`), saison 0 ignorée. Sans saisons TMDB : saison 1 et `anime.episodes`.
- « En cours » automatique : au premier épisode vu (> 90 %). Ajout à la liste si l'anime n'y est pas. Aucun changement si le statut est `completed` ou `dropped`.
- Profil privé et profil inexistant renvoient tous deux `null`, et la page affiche le même message.
- Pas de commit (consigne de l'utilisateur) : les étapes « Commit » sont remplacées par une ligne dans le journal.
- Textes de l'interface en français. Ne pas dégrader l'expérience sans compte.

## Review Focus

1. **Un visiteur ne doit voir aucun champ privé** : ni bloc masqué, ni progression brute, ni ligne supprimée, ni profil privé. Test SQL, Task 1 step 4.
2. **`set_banner` avec une bannière non débloquée** : l'appel est refusé et la bannière reste inchangée. Test SQL, Task 1 step 4.
3. **Anime encore en diffusion, dernier épisode visible** : pas de passage à « Terminé ». Test `autoComplete: releasing anime never completes`, Task 2.
4. **Anime marqué Terminé à la main, puis épisode revu** : le statut ne repasse pas « En cours ». Test `nextStatusOnWatched keeps completed`, Task 2.
5. **Store v4 existant** : toutes les entrées de Ma liste deviennent `planned`, sans perte. Test de migration, Task 3.

---

### Task 1: Base — suivi, notes d'épisodes, bannières, RPC publiques

**Files:**
- Create: `supabase/migrations/20261106000003_profile_tracking.sql`
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces :
  - Sur `watchlist_entries` :
    - `list_status text not null default 'planned'`, avec un check sur les 5 valeurs ;
    - `rating smallint` (check 1–10) ;
    - `completed_on_sakura_at timestamptz` ;
    - `favorite boolean not null default false`.
  - Table `episode_ratings` :
    - colonnes `user_id`, `anime_id`, `season`, `episode`, `rating smallint` (check 1–10), `updated_at`, `deleted_at`, `synced_at` ;
    - PK `(user_id, anime_id, season, episode)` ;
    - trigger `set_synced_at`, index `(user_id, synced_at)`, RLS propriétaire `for all`.
  - Table `unlocked_banners` :
    - colonnes `user_id`, `anime_id int`, `banner_url text not null`, `is_trophy boolean not null default false`, `title text`, `unlocked_at timestamptz default now()` ;
    - PK `(user_id, anime_id)` ;
    - RLS propriétaire : select et insert seulement (ni update ni delete).
  - `profiles.banner_id` : default `'default:1'`. `profiles.visibility` : default `{"blocks":[…ordre par défaut…]}`.
  - `set_banner(banner text) returns void` (`security definer`) :
    - accepte `default:1..4` ;
    - accepte `anime:<id>` seulement si une ligne `unlocked_banners` existe pour `auth.uid()` ;
    - sinon `raise exception 'banner_locked'`.
  - `get_public_profile(name text) returns jsonb` (`security definer`, `stable`) :
    - renvoie `null` si le profil est absent ou s'il est privé et que `auth.uid()` n'est pas son propriétaire ;
    - sinon renvoie la forme exacte ci-dessous.

    ```
    { username, display_name, avatar_url, created_at, is_public, is_owner,
      banner: { id, url|null, title|null },
      trophies: [{ anime_id, title, banner_url }],
      blocks: [{ id, items|stats }]   -- uniquement les blocs visibles, dans l'ordre
    }
    ```

  - Contenu de chaque bloc (20 éléments maximum, `deleted_at is null`) :
    - item : `{anime_id,title,cover,color,list_status,rating,episode?,season?,completed_on_sakura}` ;
    - `stats` : `{completed, watching, hours, avg_rating}`, où `hours` = somme de `episode_progress.time` / 3600, arrondie ;
    - `favorite` : les entrées avec `favorite`, au plus 1 ;
    - `top_rated` : tri par `rating desc` puis `updated_at desc`, `rating is not null` ;
    - `episode_ratings` : les plus récentes, avec le titre tiré de `watchlist_entries`, sinon de `history_entries` ;
    - `watching`, `completed` et `planned` : tri par `updated_at desc`.
  - Grants :
    - `get_public_profile` à `anon` et `authenticated` ;
    - `set_banner` à `authenticated`, avec un revoke explicite pour `anon`.

- [ ] **Step 1:** Écrire la migration (respecter le style de `20261106000001_accounts.sql` : `search_path = ''`, `(select auth.uid())`).
- [ ] **Step 2:** `apply_migration` (name `profile_tracking`). Expected : succès (l'utilisateur confirme dans l'interface).
- [ ] **Step 3:** `get_advisors` security et performance. Expected : seulement les alertes SECURITY DEFINER voulues sur les RPC ; corriger tout le reste.
- [ ] **Step 4: Tests SQL** (une transaction, puis `rollback`)
  - Données : utilisateurs A (public, `foxy`) et B (privé, `bob`). A a :
    - une entrée `completed` notée 9,
    - une entrée supprimée,
    - un `episode_progress`,
    - une note d'épisode,
    - le bloc `planned` masqué et une entrée `planned`.
  - Assertions :
    - en anonyme, `get_public_profile('bob')` est null ;
    - en anonyme, `get_public_profile('nobody')` est null ;
    - en tant que B, `get_public_profile('bob')` n'est pas null et `is_owner` = true ;
    - le JSON de `foxy` ne contient ni la clé `time`, ni l'entrée supprimée, ni de bloc `planned` ;
    - `stats.completed` = 1 ;
    - en tant que A, `set_banner('anime:999')` lève `banner_locked` ;
    - `set_banner('default:3')` passe ;
    - après insertion dans `unlocked_banners`, `set_banner('anime:999')` passe ;
    - B ne peut ni lire ni insérer dans les `unlocked_banners` de A.
- [ ] **Step 5:** Mettre à jour `database.types.ts` (nouvelles colonnes, tables et fonctions). `npx tsc --noEmit` → 0 erreur.
- [ ] **Step 6:** Ligne de journal.

### Task 2: Logique de suivi pure

**Files:**
- Create: `src/core/tracking.ts`, `src/core/tracking.test.ts`, `src/lib/trophies.ts`

**Interfaces:**
- Produces (`tracking.ts`, sans import `@/`) :
  - `type ListStatus = 'planned' | 'watching' | 'paused' | 'completed' | 'dropped'` ;
  - `STATUS_LABELS: Record<ListStatus, string>` ;
  - `nextStatusOnWatched(current: ListStatus | null): ListStatus | null` : `null` ou `planned` ou `paused` → `watching` ; `watching`, `completed` et `dropped` → inchangé (renvoie `current`) ;
  - `isFinalEpisode(args: { anilistStatus?: string | null; tmdbSeasons?: { season_number: number; episode_count?: number }[]; anilistEpisodes?: number | null; season: number; episode: number }): boolean` ;
  - `type BlockId = 'stats' | 'favorite' | 'watching' | 'completed' | 'top_rated' | 'episode_ratings' | 'planned'` ;
  - `DEFAULT_BLOCKS: { id: BlockId; visible: boolean }[]` ;
  - `normalizeBlocks(raw: unknown): { id: BlockId; visible: boolean }[]` : garde l'ordre valide, ajoute les blocs manquants avec leur visibilité par défaut, retire les inconnus.
- `trophies.ts` :
  - `TROPHY_POPULARITY = 150_000` ;
  - `TROPHY_OVERRIDES = { include: [] as number[], exclude: [] as number[] }` ;
  - `isTrophy(id: number, popularity?: number | null): boolean`.

- [ ] **Step 1: Tests**
  - `autoComplete: releasing anime never completes` : `isFinalEpisode({anilistStatus:'RELEASING', tmdbSeasons:[{season_number:1,episode_count:12}], season:1, episode:12})` === false.
  - `autoComplete: last episode of last season` : `FINISHED` avec les saisons `[{1,12},{2,13}]` ; S2E13 → true ; S1E12 → false.
  - `autoComplete: no tmdb seasons uses anilist episodes` : `{FINISHED, tmdbSeasons:[], anilistEpisodes:24, season:1, episode:24}` → true.
  - `nextStatusOnWatched keeps completed` : `completed` → `completed` ; `dropped` → `dropped` ; `null` → `watching` ; `paused` → `watching`.
  - `normalizeBlocks repairs input` : `[{id:'planned',visible:true},{id:'bogus',visible:true}]` → `planned` en premier (visible), suivi des 6 autres dans l'ordre par défaut ; `bogus` est absent.
  - `isTrophy` : `(1, 150000)` → true ; `(1, 149999)` → false.
- [ ] **Step 2:** `npm test` → FAIL ; implémenter ; `npm test` → tout PASS.
- [ ] **Step 3:** Ligne de journal.

### Task 3: Store v5 + synchro des nouveaux champs

**Files:**
- Modify: `src/core/store.ts`, `src/core/sync/mappers.ts`, `src/core/sync/mappers.test.ts`, `src/core/sync/engine.ts`
- Create: `src/core/store-migrate.ts`, `src/core/store-migrate.test.ts` (migration pure, testable)

**Interfaces:**
- Consumes : `ListStatus` (Task 2).
- Produces :
  - `SavedAnime` gagne `listStatus: ListStatus`, `rating?: number | null`, `completedOnSakuraAt?: number | null`, `favorite?: boolean`.
  - `EpisodeRating = { rating: number; updatedAt: number }`.
  - État : `episodeRatings: Record<string, EpisodeRating>`, avec des clés `<anime>:<season>:<ep>` (`progressKey`). Les suppressions vont dans `deleted` sous `r:<anime>:<season>:<ep>`.
  - Actions :
    - `setListStatus(anime: AnimeRef, status: ListStatus | null)` : `null` retire de la liste (pierre tombale) ; sinon ajoute ou met à jour, avec `updatedAt` = maintenant ;
    - `setAnimeRating(id: number, rating: number | null)` ;
    - `setFavorite(id: number, fav: boolean)` : un seul favori, l'ancien est mis à false ;
    - `rateEpisode(animeId: number, season: number, episode: number, rating: number | null)` ;
    - `markCompletedOnSakura(id: number)`.
  - `toggleWatchlist` est conservé et appelle `setListStatus(anime, present ? null : 'planned')`.
  - `migrateStore(persisted: unknown, fromVersion: number): SyncSnapshotV5` dans `store-migrate.ts` : v4 → v5 donne `listStatus: 'planned'` et `episodeRatings: {}`. Le store passe en `version: 5`.
  - `SyncSnapshot` gagne `episodeRatings`.
  - `mappers.ts` :
    - `SyncRows` gagne `episodeRatings: Row<EpisodeRatingValue>[]` ;
    - nouvelles fonctions `episodeRatingToDb` et `episodeRatingFromDb` ;
    - `watchlistToDb` et `watchlistFromDb` gèrent les 4 nouveaux champs (`completed_on_sakura_at` en ISO).
  - `engine.ts` : `episode_ratings` est récupérée et envoyée comme les autres tables (`onConflict 'user_id,anime_id,season,episode'`), et `changedKeys` détecte `episodeRatings`.

- [ ] **Step 1: Tests**
  - `migrate v4→v5 sets planned` : `{watchlist:[{id:1,…,updatedAt:5}]}` → `listStatus:'planned'`, `episodeRatings:{}`.
  - `mappers: watchlist round-trips status, rating, favorite, completedOnSakuraAt`.
  - `mappers: episode rating tombstone maps to deleted_at`.
  - `mappers: snapshot rebuilds episodeRatings`.
- [ ] **Step 2:** `npm test` → FAIL ; implémenter ; PASS. `npx tsc --noEmit` → 0 (corriger les appels existants à `toggleWatchlist` et `SavedAnime`).
- [ ] **Step 3:** Ligne de journal.

### Task 4: Fiche anime — statut, notes, auto-suivi, déblocage

**Files:**
- Create : `src/components/anime/status-picker.tsx`, `src/components/anime/rating-picker.tsx`, `src/core/unlock.ts`
- Modify : `src/app/anime/page.tsx`, `src/core/api/anilist.ts` (ajouter `popularity` à `GET_ANIME_DETAILS`)

**Interfaces:**
- Consumes : actions du store (Task 3), `isFinalEpisode`, `nextStatusOnWatched`, `isTrophy`, `supabase`, `useAuthStore`.
- Produces :
  - `<StatusPicker anime={AnimeRef} />` : bouton qui affiche le statut courant (« Ma liste » si absent). Il ouvre un menu avec les 5 statuts et « Retirer de ma liste ». Il remplace le bouton Ma liste de la fiche.
  - `<RatingPicker value={number|null} onChange={(n|null)=>void} size="sm"|"md" label={string} />` : 10 pastilles ; un clic sur la valeur courante l'efface.
  - `unlockBanner(anime: { id: number; title: string; bannerImage?: string | null; popularity?: number | null }): Promise<void>` :
    - ne fait rien sans session ou sans `bannerImage` ;
    - insère dans `unlocked_banners` (en ignorant le conflit).
- Comportement dans la fiche : un effet observe la progression de l'épisode en cours. Quand il franchit `isWatched` pour la première fois :
  1. statut = `nextStatusOnWatched(statut)`, ajout à la liste si l'anime est absent ;
  2. si `isFinalEpisode(...)` : `setListStatus('completed')`, puis `markCompletedOnSakura`, puis `unlockBanner`, puis un toast « Bannière débloquée » (avec 🏆 si trophée).
- Note de l'anime à côté du statut (`RatingPicker`, uniquement si l'anime est dans la liste). Note par épisode : petit bouton ★ sur chaque carte d'épisode, qui ouvre un `RatingPicker` sans lancer la lecture (`stopPropagation`).

- [ ] **Step 1:** Implémenter les composants et `unlock.ts`, puis brancher la fiche.
- [ ] **Step 2: Vérifier dans le navigateur** (mobile et desktop) :
  - choisir un statut, puis Retirer ;
  - noter l'anime et un épisode ;
  - simuler un épisode vu en injectant une progression > 90 % dans le store → l'anime passe « En cours » ;
  - sur un anime `FINISHED` court, injecter le dernier épisode vu → l'anime passe « Terminé » et le toast s'affiche.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm test` → OK. Ligne de journal.

### Task 5: Lecteur — invite de note en fin d'épisode

**Files:**
- Modify : `src/components/player/player-overlay.tsx`, `src/app/anime/page.tsx`

**Interfaces:**
- `PlayerOverlay` reçoit deux nouvelles props : `episodeRating: number | null` et `onRateEpisode: (n: number | null) => void`.
- Comportement :
  - Quand `time / duration ≥ 0.9` ou à `onEnded`, afficher une petite carte « Noter cet épisode » (`RatingPicker size="sm"`) en bas à gauche, au-dessus des contrôles.
  - Elle disparaît après la note, après 12 s, ou au lancement de l'épisode suivant.
  - Elle n'affecte jamais `countdown`.

- [ ] **Step 1:** Implémenter.
- [ ] **Step 2: Vérifier dans le navigateur** : la carte apparaît en fin d'épisode, le compte à rebours de l'épisode suivant continue, et la note est enregistrée dans le store.
- [ ] **Step 3:** Ligne de journal.

### Task 6: Page Ma liste par statut

**Files:**
- Modify : `src/app/watchlist/page.tsx`, `src/components/anime/anime-card.tsx` (prop facultative `badge?: string`)

- [ ] **Step 1:**
  - Onglets ou pastilles : Tout, puis les 5 statuts, avec leurs compteurs. Le filtre est gardé dans l'URL (`?status=`), avec `useSearchParams` sous `<Suspense>`.
  - Chaque carte affiche le statut et la note de l'utilisateur.
  - Texte de liste vide adapté à chaque filtre.
- [ ] **Step 2: Vérifier dans le navigateur** : filtres, compteurs, URL.
- [ ] **Step 3:** Ligne de journal.

### Task 7: Avatar + menu (remplace le ⚙️)

**Files:**
- Create : `src/components/account/account-menu.tsx`
- Modify : `src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes : `useAuth`, `signIn`, `signOut`, `Avatar`, `accountsEnabled`.
- Produces :
  - `<AccountMenu placement="mobile" | "sidebar" />` : déclencheur avatar 40 px (sur mobile, même position que l'ancien ⚙️) ou 30 px dans la barre latérale.
  - Popover en matériau `tab-bar-glass`.
  - Connecté : en-tête (avatar, nom, `@pseudo`), Mon profil (`/<pseudo>`, ou `/onboarding` sans pseudo), Partager mon profil (`navigator.share`, sinon copie dans le presse-papiers avec « Lien copié »), Paramètres, Déconnexion.
  - Déconnecté : icône personne ; Continuer avec Discord, Continuer avec Google, Paramètres.
  - Sans `accountsEnabled` : retour au lien ⚙️ actuel.
  - Fermeture : Échap, clic extérieur, navigation. Rôle `menu` et `aria-expanded`.

- [ ] **Step 1:** Implémenter et remplacer les deux liens ⚙️ de `sidebar.tsx`.
- [ ] **Step 2: Vérifier dans le navigateur** : mobile 412 px et desktop 1400 px, déconnecté (captures), ouverture et fermeture au clavier.
- [ ] **Step 3:** Ligne de journal.

### Task 8: Page profil `/<pseudo>` + édition + bannières

**Files:**
- Create :
  - `src/app/[username]/page.tsx` (serveur), `src/app/[username]/profile-view.tsx` (client) ;
  - `src/components/profile/blocks.tsx`, `src/components/profile/edit-sheet.tsx`, `src/components/profile/banner-picker.tsx` ;
  - `src/lib/banners.ts` ;
  - `public/banners/default-1.svg` … `default-4.svg` (dégradés SAKURA en attendant les visuels de l'utilisateur) ;
  - `src/lib/supabase-server.ts`.
- Modify : `src/lib/database.types.ts` si nécessaire.

**Interfaces:**
- `supabase-server.ts` : `getPublicProfile(username: string): Promise<PublicProfile | null>`.
  - Client `createClient` sans session (clé publiable), qui appelle `rpc('get_public_profile')`.
  - `PublicProfile` est le type de la forme JSON de Task 1.
- `banners.ts` :
  - `DEFAULT_BANNERS: { id: 'default:1'…; url: string; label: string }[]` ;
  - `resolveBanner(id: string | null, unlocked: { anime_id: number; banner_url: string }[]): string`.
- Page serveur :
  - `export const revalidate = 60` ;
  - `generateMetadata` : `title: '<display_name> (@pseudo)'`, `openGraph.images = [banner.url]`, description « Profil SAKURA » + nombre de terminés si `stats` est visible ;
  - profil `null` → message « Ce profil est privé ou n'existe pas » ;
  - pseudo mal formé (regex) → `notFound()` sans appel RPC.
- `profile-view.tsx` (client) :
  - en-tête validé (bannière, avatar à gauche et nom à côté, pastilles trophées), chiffres clés, puis les blocs (lignes horizontales de couvertures, avec la note ou l'épisode sur chaque couverture) ;
  - si `is_owner` (déterminé côté client) : rappel de la session avec le client navigateur et du profil complet, puis bouton « Modifier le profil ».
- `edit-sheet.tsx` :
  - interrupteur Public/Privé ;
  - liste des blocs avec case à cocher et boutons ↑↓ (`normalizeBlocks`) ;
  - bouton « Bannière » qui ouvre `banner-picker` ;
  - enregistrement par `profiles.update({ is_public, visibility })`, puis `router.refresh()`.
- `banner-picker.tsx` :
  - « Débloquées » (4 par défaut, puis `unlocked_banners` de l'utilisateur, avec 🏆 sur les trophées) ;
  - « À débloquer » : les animes de la liste en `watching` ou `planned` qui ont une bannière, en grisé, avec « Terminez-le sur SAKURA » et la progression (épisodes vus / total quand connu) ;
  - au choix : `rpc('set_banner')`.
- Le bouton « Mon profil » du menu y mène. Le lien partagé est `${origin}/${username}`.

- [ ] **Step 1:** Implémenter le serveur et la vue, puis vérifier avec `curl -s localhost:3000/<pseudo-test>` : `og:image` et le titre sont dans le HTML ; un profil privé ou inexistant affiche le message.
  - Données de test : un compte temporaire créé en SQL, puis supprimé.
  - Pour la session dans le navigateur : demander à l'utilisateur un login réel, ou réactiver temporairement l'email. Sinon, vérifier la vue propriétaire avec un compte réel de l'utilisateur.
- [ ] **Step 2:** Implémenter l'édition et le sélecteur. Vérifier dans le navigateur (avec session) : passage en public, ordre des blocs, bannière par défaut puis bannière débloquée ; une bannière non débloquée reste impossible à choisir.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm test`, lint des fichiers touchés → OK. Ligne de journal.

### Task 9: Vérification finale

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` → OK. `/[username]` apparaît comme route dynamique (ƒ).
- [ ] `get_advisors` → aucune alerte nouvelle hors RPC voulues.
- [ ] README : section Suivi (statuts, notes, profil, bannières). Page confidentialité : profil public (ce qui est visible, privé par défaut).
- [ ] Revue finale (relecture du diff entier selon `code-reviewer.md`), puis rapport.
