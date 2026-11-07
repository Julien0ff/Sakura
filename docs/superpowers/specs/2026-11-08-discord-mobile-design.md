# M4 — Statut Discord dans les apps mobiles

Date : 8 novembre 2026 · Fait suite à `2026-11-07-mobile-apps-design.md` (étape M4)

## Pourquoi
Avoir sur téléphone le même statut Discord que sur PC (« Regarde <anime> · Épisode », barre de
progression, navigation). Sur PC l'app parle à Discord installé (IPC) ; un téléphone interdit ça :
il faut le **Discord Social SDK** et que l'utilisateur **relie son compte Discord** une fois.

## Décisions (utilisateur)
- **Échange du code par le serveur du site** : `POST /api/discord/token` (Vercel) échange le code
  OAuth2 (PKCE) ou rafraîchit le jeton avec le secret de l'app Discord (`DISCORD_CLIENT_SECRET`,
  variable Vercel). L'app Discord reste « confidentielle ».
- **SDK dans un dépôt privé** (`Julien0ff/sakura-sdk`), téléchargé par le workflow avec un jeton en
  lecture seule (secret `SOCIAL_SDK_TOKEN`). Jamais dans le dépôt public.

## Approches écartées
- IPC comme sur PC : impossible sur Android / iOS.
- « Public Client » : refusé (voir ci-dessus).
- SDK C++ (`discordpp.h`) : il faudrait compiler du C++ en plus ; l'API C (`cdiscord.h`) suffit,
  appelée directement depuis Rust.

## Conception
- **Rust, module `discord_sdk`** (mobile ; compilé aussi sur Linux pour les tests, avec la
  bibliothèque Linux du SDK) : liaisons minimales vers `cdiscord.h`, un fil dédié qui possède le
  `Discord_Client` et appelle `Discord_RunCallbacks` en boucle ; les commandes y passent par un canal.
  - Relier : vérificateur PKCE → `Authorize` (portées « présence » par défaut) → code → serveur du
    site → jetons → `UpdateToken(Bearer)` → `Connect`. Jeton de rafraîchissement sauvegardé dans
    les données de l'app ; au lancement : rafraîchir → `UpdateToken` → `Connect`.
  - Statut : la même commande `set_presence` et le même contenu que sur PC (module de présence
    partagé), traduit en `Discord_Activity` (Regarde, détails, état, image, début/fin).
  - Délier : `Disconnect`, fichier de jetons supprimé.
- **Site** : Paramètres › Application (mobile) : « Relier Discord » / compte relié + « Délier »,
  « Statut Discord » et « Afficher la navigation » comme sur PC. Les appels de présence partent
  dans toutes les apps (le mobile les ignore tant que le compte n'est pas relié).
- **Builds** :
  - Android : `.aar` + `androidx.browser 1.8.0` ajoutés au projet Gradle, `AuthenticationActivity`
    avec le schéma `discord-1568341036894523432`, permissions micro/Bluetooth/service du SDK
    retirées (pas de vocal), `DiscordSocialSdkInit.setEngineActivity(this)` dans `MainActivity`.
  - iPhone : `.xcframework` (bibliothèque dynamique) lié et intégré via `project.yml` (xcodegen).

## Ce que l'utilisateur doit faire
1. Portail Discord › OAuth2 › Redirects : ajouter `discord-1568341036894523432:/authorize/callback`.
2. Vercel : variable `DISCORD_CLIENT_SECRET` (OAuth2 › Client Secret). Ne jamais la coller ici.
3. Dépôt privé `Julien0ff/sakura-sdk` avec `android/discord_partner_sdk.aar`,
   `ios/discord_partner_sdk.xcframework`, `include/cdiscord.h` ; jeton GitHub « fine-grained » en
   lecture seule sur ce dépôt → secret `SOCIAL_SDK_TOKEN` du dépôt Sakura.

## Limites connues
- Rien n'est testable sur téléphone avant un build CI ; les liaisons Rust sont testées sur Linux.
- Le statut n'apparaît que quand l'app est ouverte (le système suspend les apps en arrière-plan).
