# PreMiD Presence pour SAKURA 🌸

Cette présence PreMiD permet d'afficher automatiquement votre activité SAKURA sur Discord en temps réel lorsque vous utilisez le site web (exactement comme sur les versions Desktop) :
- Titre de l'anime ou du dessin animé en cours
- Saison, numéro d'épisode et langue (VF / VOSTFR)
- Affiche officielle de l'œuvre en grand format
- Barre de progression dynamique synchronisée avec le lecteur
- Bouton interactif « Regarder sur SAKURA »
- Statut de navigation lors du parcours du site (« Parcourt le catalogue », « Cherche un anime », etc.)

---

## 1. Pourquoi PreMiD ne détecte pas SAKURA par défaut ?

L'extension de navigateur PreMiD ne surveille **que les sites enregistrés dans sa Library** (son catalogue officiel). Tant qu'une activité n'a pas été officiellement publiée sur le Store PreMiD ou lancée en mode développeur, l'extension ignore le domaine.

De plus, l'outil `pmd` n'est pas un package npm standalone publiable : c'est le CLI interne du monorepo officiel `PreMiD/Activities`.

---

## 2. Utilisation en mode Développeur (Immédiat en local)

Le dépôt officiel `PreMiD/Activities` a été installé et configuré dans `/home/foxy/Projets/PreMiD-Activities`.

### Étape 1 : Activer le mode développeur dans l'extension
1. Cliquez sur l'icône de l'extension **PreMiD** dans votre navigateur Chrome/Brave/Edge.
2. Ouvrez les **Paramètres** (icône ⚙️ engrenage).
3. Activez l'option **« Mode Développeur d'Activités »** (ou *Activity Developer Mode*).
4. Assurez-vous que l'application de bureau PreMiD est bien lancée sur votre ordinateur.

### Étape 2 : Lancer la présence SAKURA
Depuis le dossier de votre projet SAKURA, lancez simplement :
```bash
npm run premid:dev
```
Ou directement :
```bash
cd "/home/foxy/Projets/PreMiD-Activities"
npx pmd dev SAKURA
```

Le CLI va compiler l'activité, se connecter directement à votre extension et injecter SAKURA. Ouvrez `https://sakura.thefoxy.me` et lancez un épisode ou naviguez : votre Rich Presence Discord s'actualise instantanément !

---

## 3. Comment faire pour que SAKURA soit disponible pour TOUT LE MONDE dans la Library PreMiD ?

Pour que n'importe quel utilisateur puisse simplement chercher « SAKURA » dans le store PreMiD et cliquer sur « Ajouter » sans avoir à ouvrir de terminal :

1. Fourchez le dépôt [PreMiD/Activities sur GitHub](https://github.com/PreMiD/Activities).
2. Créez une branche (ex: `feat/sakura-presence`).
3. Placez les fichiers de `premid/` dans `websites/S/SAKURA/` :
   - `metadata.json`
   - `presence.ts`
   - `tsconfig.json`
4. Soumettez une **Pull Request** sur `PreMiD/Activities`.
5. Une fois vérifiée et mergée par les modérateurs PreMiD, SAKURA apparaîtra automatiquement dans la bibliothèque officielle PreMiD accessible à tous les utilisateurs.
