# PreMiD Presence pour SAKURA 🌸

Cette présence PreMiD permet d'afficher automatiquement votre activité SAKURA sur Discord en temps réel lorsque vous utilisez le site web (comme sur les applications de bureau) :
- Titre de l'anime ou du dessin animé
- Saison, numéro d'épisode et langue (VF / VOSTFR)
- Affiche / jaquette officielle en grand
- Barre de progression dynamique synchronisée avec la lecture
- Bouton interactif « Regarder sur SAKURA »
- Statut de navigation lorsque vous parcourez le site (« Parcourt le catalogue », « Cherche un anime », etc.)

---

## Comment l'utiliser avec PreMiD

### Option 1 : Via PreMiD CLI (mode développement local)
1. Installez l'outil PreMiD CLI (si ce n'est pas déjà fait) :
   ```bash
   npm install -g premid
   ```
2. Rendez-vous dans le dossier `premid` :
   ```bash
   cd premid
   ```
3. Lancez la présence :
   ```bash
   premid dev
   ```
4. Ouvrez `https://sakura.thefoxy.me` dans votre navigateur (avec l'extension PreMiD installée et active). Votre statut Discord s'actualise instantanément !

---

### Option 2 : Ajout manuel dans le dossier des présences PreMiD
1. Copiez le dossier `premid/` dans votre dossier local de présences PreMiD.
2. Activez les présences locales dans les paramètres de l'extension PreMiD.
