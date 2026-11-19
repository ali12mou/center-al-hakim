# AL-HAKIM CENTER — Flutter et API Node.js

Application Android/iOS/web avec deux espaces indépendants. Le dossier était vide avant cette implémentation. Les portails React existants sont conservés.

## APK livré

`build/app/outputs/flutter-apk/AL-HAKIM-CENTER-1.0.1.apk` — version 1.0.1, logo officiel et accueil étudiant actualisé. APK universel, API configurée sur `https://alhakimcenter.com`.

SHA-256 : `03F0536550457106AAA95C7DEA0E1AE9DAF83798586677EF9E4668B430A806BE`.

Cette version installable utilise la configuration de signature de développement générée par Flutter. Avant une publication sur Google Play, configurer une clé de signature appartenant au centre. Aucun identifiant, mot de passe ou fichier `.env` n’est inclus dans l’application.

## Fonctionnalités

- Connexion Étudiant ou Marketing, arrivée sur un accueil personnel et changement obligatoire du mot de passe provisoire.
- Sessions natives conservées dans le stockage sécurisé du système ; cookies et jetons CSRF distincts par rôle. Sur web, utilisation des cookies HttpOnly existants et de CORS avec credentials.
- Navigation latérale sur ordinateur, navigation inférieure et menu Plus sur téléphone. Le contenu et les formulaires restent dans la zone disponible.
- Étudiant : formations, ressources publiées, notes, présences, planning, annonces, échéances, historique de paiement et export de factures/reçus en PDF.
- Carte numérique avec QR code et PDF imprimable. Le lien public ne contient qu’un identifiant aléatoire. Il affiche uniquement le nom, le matricule, la validité et le statut.
- Marketing : accueil, catalogue et supports approuvés, tableau de bord filtrable, collecte, prospects paginés et filtrés, historique des interactions, relances datées avec heure et consentement par canal.
- Les actions téléphone et WhatsApp préparent le contact. Elles ne créent aucune preuve automatique d’appel effectué ou de message envoyé.
- Les conversions correspondent aux inscriptions validées par l’administration, et non à une modification libre de l’agent.

Les informations non renseignées restent « À confirmer », « Planning à venir » ou « Aucune note publiée ». Aucune donnée pédagogique ou financière de démonstration n’est ajoutée aux comptes réels.

## Installation et lancement

Depuis la racine du projet, lancer l’API existante avec `npm.cmd run dev`, puis :

```powershell
cd mobile
C:\src\flutter\bin\flutter.bat pub get
C:\src\flutter\bin\flutter.bat run --dart-define=API_BASE_URL=https://alhakimcenter.com
```

Pour un émulateur Android avec l’API locale, utiliser `--dart-define=API_BASE_URL=http://10.0.2.2:4100`. Le HTTP est autorisé uniquement par le manifeste Android de débogage. Un téléphone physique doit utiliser une adresse accessible depuis son réseau ou le domaine HTTPS.

Pour Flutter web, ajouter l’origine exacte du serveur web Flutter à `CLIENT_ORIGIN` dans `Backend/.env`, puis redémarrer Node. Les cookies sécurisés de production nécessitent HTTPS et un contexte compatible avec les cookies SameSite. Un déploiement sous le même domaine que l’API est recommandé.

```powershell
C:\src\flutter\bin\flutter.bat analyze
C:\src\flutter\bin\flutter.bat test
C:\src\flutter\bin\flutter.bat build apk --release --dart-define=API_BASE_URL=https://alhakimcenter.com
```

## Déployer l’API et le site associés

L’APK ne déploie pas le serveur. Copier les nouveaux fichiers backend et frontend sur le serveur en conservant `Backend/.env`, MongoDB et les fichiers importés existants.

Dans `Backend/.env` du serveur :

```dotenv
NODE_ENV=production
TRUST_PROXY=loopback
PUBLIC_URL=https://alhakimcenter.com
CLIENT_ORIGIN=https://alhakimcenter.com
```

`loopback` suppose Nginx sur la même machine que Node. Si le proxy est distant, configurer son IP ou son sous-réseau exact.

```bash
cd /var/www/center-al-hakim
npm ci
npm run build
NODE_ENV=production TRUST_PROXY=loopback pm2 restart alhakimcenter --update-env
pm2 logs alhakimcenter --lines 50
```

Les ajouts de collections/champs sont non destructifs. Les données précédentes restent en place. Les articles d’exemple explicitement demandés et les présentations initiales sont ajoutés une seule fois ; une suppression ultérieure n’est pas annulée par un redémarrage.

## Administration

- **Centre → Bannières et annonces** : audiences public/étudiant/marketing, formation et groupe, dates, ordre, publication, archivage. Choisir l’emplacement « Pied de page » pour une campagne temporaire du footer.
- **Centre → Paramètres du site** : coordonnées communes, URL Google Maps officielle, lien d’intégration de la carte, textes, logo et liens du footer.
- **Centre → Présentation du centre** : carrousel du bloc de présentation.
- **Centre → Blog** : articles, images et vidéos MP4/WebM jusqu’à 60 Mo. Les vidéos de deux minutes et plus sont acceptées ; aucune limite de durée n’est imposée.
- **Centre → Compétence / formation** : créer et modifier le catalogue, avec le type Compétence ou Formation. Les identifiants existants restent utilisables.
- **Élèves → Accès à l’application** : créer les comptes, consulter la fenêtre d’identifiants et révoquer une carte étudiant. Une carte est créée lors de sa première consultation, avec une validité initiale d’un an. La révocation est contrôlée en temps réel lors de la lecture du QR code.
- Le champ Groupe doit être identique sur le dossier financier de formation, les leçons, le planning et les annonces. Vide signifie contenu commun à la formation. Les anciens documents sans ce champ restent compatibles.

Le QR code ouvre `/api/cards/verify/:token`. Le serveur renvoie une page lisible dans le navigateur ou du JSON avec `Accept: application/json`. Aucun nom d’un autre étudiant, paiement, note, e-mail ou téléphone n’est accessible en modifiant les identifiants des routes privées.

## Vérifications réalisées

52 tests backend passent, dont le scénario des audiences, groupes, documents privés, carte valide/expirée/révoquée, filtre agent et refus des confirmations non autorisées. Deux tests Flutter vérifient les accueils, la navigation téléphone/ordinateur et la connexion ; l’analyse Flutter ne signale aucune erreur. Les formulaires et les principaux blocs publics ont aussi été contrôlés dans le navigateur.

L’APK a été compilé, mais aucun téléphone physique n’était connecté pour un essai d’installation. iOS n’a pas été compilé sur cette machine Windows. Les interactions réelles avec le serveur de production doivent être vérifiées après son déploiement.
