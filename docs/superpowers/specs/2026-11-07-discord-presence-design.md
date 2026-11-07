# SAKURA Desktop — étape 2 : statut Discord (Rich Presence)

Date : 7 novembre 2026 · Statut : validé (conception courte)

## Pourquoi
Montrer sur Discord ce qu'on regarde sur SAKURA (façon PreMiD), sans extension : c'est l'app desktop qui parle à Discord.

## Ce qui est décidé
- **Pendant la lecture** : activité de type « Regarde » au nom de l'application Discord (ID `1568341036894523432`, nom affiché « SAKURA »).
  Ligne 1 : titre de l'anime. Ligne 2 : « Saison 1 · Épisode 12 · VF » (la saison seulement s'il y en a plusieurs).
  Grande image : jaquette AniList (URL https) ; petite image : logo `https://sakura.thefoxy.me/icon.png`.
  Barre de temps (début/fin) quand la durée est connue ; bouton « Regarder sur SAKURA » → fiche de l'anime.
- **En pause** : ligne 2 « En pause · Épisode 12 », sans barre de temps.
- **Lecteurs intégrés (iframe)** : pas d'évènements lecture/pause → « Regarde » sans barre de temps tant que le lecteur est ouvert.
- **Hors lecture** : aucun statut (le lecteur fermé efface l'activité).
- **Réglage** : « Statut Discord » dans Paramètres › Application, activé par défaut ; désactivé → l'activité est effacée.
- **Discord fermé** : rien ne se passe ; l'app se reconnecte (toutes les 15 s) et réapplique l'activité courante.

## Approches
- **Rust parle à Discord en IPC (retenue)** : crate `discord-rich-presence`, un fil dédié qui garde l'état voulu et se reconnecte.
- Plugin `tauri-plugin-drpc` : jeune (0.1), API moins maîtrisée ; écarté.
- PreMiD côté web : demande une extension ; écarté (c'est le rôle de l'app).

## Laissé au constructeur
Découpage Rust, fréquence d'envoi (pas plus d'une mise à jour par changement d'état / saut dans la vidéo), limites de longueur Discord (2–128 caractères).
