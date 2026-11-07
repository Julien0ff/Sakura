# SAKURA Desktop — étape 3 : notifications de sortie

Date : 7 novembre 2026 · Statut : validé (conception courte)

## Décisions
- Animes suivis : « Ma liste » en statut En cours ou À voir.
- Langue : réglage « Langue des sorties » (Auto = langue par défaut, VOSTFR, VF, Les deux).
- VOSTFR : planning de diffusion AniList (`airingSchedules`), notification « <titre> — L’épisode N est disponible en VOSTFR. ».
- VF : `/api/planning` (Anime-Sama), désormais rapproché d'AniList côté serveur (titres VF, lots de 25, plafond de complexité AniList) ; heure inconnue → annoncée dès 00:00 le jour J.
- L'app (Rust) vérifie toutes les 15 min (1ʳᵉ fois 1 min après le lancement), même fenêtre masquée ; le site lui pousse la liste à chaque changement, l'app la garde dans `notify-targets.json`.
- Une sortie n'est annoncée qu'une fois (`notify-state.json`, 500 dernières clés) ; premier lancement = point de départ sans rattrapage ; app fermée longtemps → rattrapage limité à 2 jours.
- Hors-ligne : la fenêtre de vérification reste ouverte, rien n'est perdu.
- Non-objectif : clic sur la notification (non pris en charge par le plugin sur Windows/Linux).
