# SAKURA Mobile — apps Android et iPhone

Date : 7 novembre 2026 · Statut : en attente de validation

## Pourquoi
Avoir SAKURA comme une vraie app sur téléphone, avec les mêmes atouts que l'app PC : connexion qui
revient dans l'app, notifications de sortie, mises à jour, statut Discord (si l'utilisateur relie son
compte), plein écran soigné. Distribution hors stores : `.apk` (Android) et `.ipa` (iPhone, via
AltStore / SideStore), tous deux publiés sur GitHub et proposés par la page « Application ».

## Approches
- **A. Tauri 2 mobile (retenue par l'utilisateur)** : même projet que l'app PC (`src-tauri`), le site
  en ligne dans la vue web, le Rust et les commandes déjà écrites réutilisées (liens `sakura://`,
  notifications, mises à jour).
- B. Capacitor : plus rodé sur mobile mais une 2ᵉ base de code. Écartée.
- C. PWA seule : déjà en place (manifeste, plein écran) ; reste la solution de repli, pas d'`.apk`/`.ipa`.

## Ce qui change par rapport au PC
| Fonction PC | Mobile |
| --- | --- |
| Statut Discord par l'app Discord locale (IPC) | Impossible sur téléphone. **Discord Social SDK** avec liaison du compte Discord (étape M4) |
| Notifications : vérification toutes les 15 min | Le système interdit un tel service : les **sorties de la semaine sont programmées à l'avance** (heures connues : AniList, planning VF) à chaque ouverture et à chaque changement de liste |
| Mises à jour silencieuses | Android : l'app propose le nouvel `.apk` (Android demande confirmation). iPhone : **source AltStore** sur le site, AltStore/SideStore mettent à jour |
| Barre des tâches, démarrage auto, mode allégé | Sans objet |

## Étapes (une conception courte + un plan chacune, comme pour le PC)
- **M1 — Socle** : app Android + iPhone qui affiche le site, connexion par navigateur + retour `sakura://`,
  bord à bord (barres système transparentes, marges `safe-area` correctes en haut et en bas),
  bouton retour Android = page précédente, liens externes dans le navigateur, page hors-ligne,
  builds GitHub Actions (`.apk` signé, `.ipa` non signé), page « Application » qui les propose.
- **M2 — Notifications programmées** : à l'ouverture et quand « Ma liste » change, l'app programme
  les notifications des 7 prochains jours (VOSTFR : AniList ; VF : `/api/planning`), en remplaçant
  les précédentes. Mêmes réglages que sur PC (activées, langue des sorties).
- **M3 — Mises à jour** : Android : vérification de la release GitHub au démarrage, message
  « Télécharger la mise à jour » → `.apk`. iPhone : `/altstore.json` (source AltStore générée depuis
  la release GitHub) + bouton « Ajouter à AltStore » sur la page Application.
- **M4 — Statut Discord mobile** : Discord Social SDK (Android `.aar`, iOS framework), bouton
  « Relier Discord » dans Paramètres › Application ; même contenu que sur PC (lecture avec barre de
  progression, navigation).

## Décisions (M1)
- Identifiant d'app `app.sakura.mobile` ? Non : **`app.sakura.desktop` est conservé** pour garder un
  seul identifiant Tauri ; le nom de paquet Android sera `app.sakura.desktop` (invisible pour l'utilisateur).
  *Choix de Claude — à confirmer.*
- Le site détecte l'app mobile via `isTauri()` + l'agent utilisateur (Android / iPhone) ; les fonctions
  PC (barre des tâches, démarrage, mode allégé, statut Discord IPC) sont désactivées sur mobile.
- Signature Android : clé créée par l'utilisateur (`keytool`), en secrets GitHub
  (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD`).
  Sans la même clé, aucune mise à jour n'est acceptée par Android : à sauvegarder.
- iPhone : `.ipa` **non signé** compilé sur `macos-latest` (Xcode), signé ensuite par AltStore/SideStore
  avec le compte Apple gratuit de l'utilisateur (réinstallation automatique tous les 7 jours).
- Icônes : Android depuis `public/icon.png` (+ icône adaptative) ; iPhone : l'icône **Liquid Glass**
  préparée par l'utilisateur (fichier `.icon` d'Icon Composer, iOS 26+) placée dans le projet Xcode,
  avec les PNG classiques en secours.
- Builds : workflow `mobile-release.yml` déclenché comme le PC (tag `app-v*`, release publiée, bouton
  manuel), qui ajoute `.apk` et `.ipa` à la même release.

## Ce que l'utilisateur doit faire
- Créer la clé Android et l'ajouter aux secrets GitHub (commande fournie).
- Déposer le fichier `.icon` Liquid Glass dans le dépôt (chemin fourni).
- M4 : télécharger le Discord Social SDK depuis le portail développeur (conditions à accepter par le
  titulaire de l'application Discord) et activer la liaison de compte.
- Tester sur son téléphone (Android) / iPhone via AltStore.

## Limites connues
- Compilation locale : le NDK Android manque et Java 27 est trop récent pour Gradle (17 ou 21) ;
  la CI GitHub compile de toute façon. iPhone : uniquement en CI (pas de Mac).
- Notifications mobiles : si l'app n'est pas ouverte pendant plus d'une semaine, plus de notifications
  jusqu'à la prochaine ouverture.
- Les lecteurs vidéo intégrés gardent leurs propres commandes système.

## Laissé au constructeur
Code Kotlin/Swift minimal nécessaire au bord à bord et aux marges, nom exact des commandes, découpage
du workflow, textes des messages.
