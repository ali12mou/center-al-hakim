# AL-HAKIM CENTER

Site professionnel en français pour le projet de centre de formation AL-HAKIM CENTER à Djibouti. Le code est organisé dans les **deux dossiers demandés : `Backend` et `Frondend`**.

## Démarrer avec une seule commande

Prérequis : Node.js 22 ou supérieur et npm. Ouvrez un terminal à la racine du projet :

```powershell
npm install
npm run dev
```

- Site React : **http://127.0.0.1:5173**
- API Node.js : **http://127.0.0.1:4100/api/health**
- `Ctrl+C` arrête les serveurs.

Le catalogue et les pages fonctionnent même sans MongoDB. Pour enregistrer les demandes de préinscription, configurez MongoDB comme expliqué ci-dessous. Tant que la base n’est pas connectée, le formulaire prépare un message WhatsApp que le visiteur peut vérifier et envoyer au **+253 77 75 66 38**.

## Les deux dossiers

```text
Center al hakim/
├── Backend/
│   ├── controllers/         # Traitement des formations et des demandes
│   ├── data/
│   │   ├── catalogue.js     # Formations, départements et coordonnées
│   │   └── siteContent.js   # Contenu des pages et questions fréquentes
│   ├── docs/                # Documentation de l’API et des visuels
│   ├── middleware/          # Gestion des erreurs
│   ├── models/              # Modèles MongoDB / Mongoose
│   ├── routes/              # Toutes les routes API
│   ├── scripts/             # Démarrage, build et export public
│   ├── tests/               # Tests de validation et de l’API
│   ├── validators/          # Validation des données reçues
│   ├── .env.example
│   ├── app.js               # Configuration Express
│   ├── index.js             # Connexion MongoDB et serveur HTTP
│   ├── seed.js              # Chargement du catalogue dans MongoDB
│   └── package.json
├── Frondend/
│   ├── assets/              # Source du visuel généré
│   ├── public/              # Images, polices et favicon
│   ├── src/
│   │   ├── components/     # Navigation, fenêtres, FAQ, pied de page
│   │   ├── pages/          # Accueil, Formations, Centre, Entreprises, Contact
│   │   ├── services/api.js # Appels vers le Backend
│   │   ├── App.jsx         # Assemblage de l’interface
│   │   ├── main.jsx        # Point d’entrée React
│   │   └── styles.css      # Design et adaptation mobile
│   ├── tests/              # Vérification des interactions dans le navigateur
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json             # Démarre les deux dossiers ensemble
├── package-lock.json        # Versions des dépendances
└── README.md
```

`node_modules`, `Frondend/dist`, `dist`, `artifacts` et les fichiers internes de l’hébergeur sont générés ou liés aux outils. Ils ne constituent pas des dossiers de code applicatif supplémentaires.

## Configurer MongoDB

À la racine, copiez le fichier d’exemple :

```powershell
Copy-Item Backend/.env.example Backend/.env
```

Dans `Backend/.env`, renseignez votre connexion MongoDB locale ou MongoDB Atlas :

```dotenv
PORT=4100
MONGODB_URI=mongodb://127.0.0.1:27017/al_hakim_center
CLIENT_ORIGIN=http://127.0.0.1:5173
NODE_ENV=development
```

Avec MongoDB Atlas, remplacez `MONGODB_URI` par l’URI de votre cluster, avec un utilisateur autorisé et l’accès réseau configuré. Ce fichier reste local et n’est pas inclus dans Git ni dans l’archive de livraison.

Chargez ensuite les formations dans la base :

```powershell
npm run db:seed
npm run dev
```

Le script utilise des mises à jour avec `upsert` : il ne supprime pas la base. Les formations sont enregistrées dans la collection `courses`, et les demandes dans `requests`. Le service renvoie une référence de demande uniquement après l’enregistrement réussi.

## Démarrer chaque dossier séparément

Dans un premier terminal :

```powershell
cd Backend
npm run dev
```

Dans un deuxième terminal :

```powershell
cd Frondend
npm run dev
```

Exécutez d’abord `npm install` à la racine. Le frontend transmet automatiquement `/api` au backend sur le port 4100. Si vous changez ce port et lancez les dossiers séparément, adaptez la cible dans `Frondend/vite.config.js`.

## Modifier le contenu

- Formations et coordonnées : `Backend/data/catalogue.js`.
- Contenu éditorial des pages : `Backend/data/siteContent.js`.
- Routes : `Backend/routes/api.routes.js`.
- Schémas de base : `Backend/models/index.js`.
- Interface : composants et pages dans `Frondend/src`.
- Couleurs, typographie et responsive : `Frondend/src/styles.css`.

Les pages sont des sections navigables d’un site de présentation. Les données métier ne sont pas définies dans les composants React. Le contenu initial est issu de la présentation française fournie ; les programmes détaillés sont des propositions éditoriales à valider avec le centre. Aucun tarif, date d’ouverture, témoignage ou agrément n’est inventé.

## Build et lancement en production

```powershell
npm run build
npm start
```

Express sert alors le build React et l’API sur **http://127.0.0.1:4100**. Pour une installation publique, utilisez un hébergement Node.js et votre base MongoDB, avec un domaine HTTPS et `NODE_ENV=production`.

Si React et l’API sont hébergés séparément, créez `Frondend/.env` depuis son fichier d’exemple, définissez `VITE_API_URL=https://votre-api`, ajoutez l’URL exacte du frontend à `CLIENT_ORIGIN` côté backend, puis relancez le build. En développement, `npm run dev` configure le proxy à partir du port du backend.

L’aperçu Sites héberge le frontend statique. Son catalogue public est exporté depuis le Backend lors du build ; il ne contient jamais les demandes des visiteurs. Sites n’exécute pas le serveur Express ni MongoDB. L’aperçu utilise donc WhatsApp tant qu’aucune API externe n’est configurée.

## Vérifications

```powershell
npm test
```

Les tests vérifient les routes, le filtrage, les validations, le consentement, les données imprévues et l’absence de fausse confirmation si la persistance échoue. La persistance est injectée dans les tests de succès : une connexion MongoDB réelle n’a pas été vérifiée dans cet environnement.

La vérification navigateur couvre le catalogue, la recherche, les fiches, la sélection d’une formation, la préparation WhatsApp, la confidentialité, les questions fréquentes et les largeurs 390, 768 et 1440 pixels. Pour la relancer avec un navigateur Playwright installé et le site démarré :

```powershell
npm run test:browser
```

## Documentation complémentaire

- [API](Backend/docs/API.md)
- [Visuels, sources et prompt Imagegen](Backend/docs/ASSETS.md)
