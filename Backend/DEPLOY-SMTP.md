# Mise en production : proxy local et OTP par e-mail

Copier les fichiers corrigés dans `/var/www/center-al-hakim`, notamment
`Backend/app.js`, `Backend/config/runtime.js`, `Backend/services/mail.service.js`,
`Backend/scripts/check-smtp.js` et `package.json`.
Ne pas remplacer le fichier `.env` du serveur par celui du poste local.
Aucune dépendance supplémentaire ni compilation frontend n'est nécessaire pour ce correctif.

## Configuration

Sur le serveur Linux :

```bash
cd /var/www/center-al-hakim
cp -p Backend/.env "Backend/.env.backup-$(date +%Y%m%d-%H%M%S)"
nano Backend/.env
```

Mettre à jour les lignes existantes, sans les dupliquer :

```dotenv
NODE_ENV=production
TRUST_PROXY=loopback
SMTP_HOST=smtp.votre-fournisseur.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-adresse@votre-domaine.com
SMTP_PASSWORD="votre-mot-de-passe-smtp"
SMTP_FROM="AL-HAKIM CENTER <votre-adresse@votre-domaine.com>"
```

Remplacer les exemples par les paramètres réels du fournisseur. Un mot de passe
contenant `#` doit être entre guillemets dans `.env`. Conserver les autres variables,
notamment MongoDB et les origines autorisées. Pour le port **465**, utiliser
`SMTP_SECURE=true` ; pour **587**, utiliser `false` (STARTTLS obligatoire).

`loopback` suppose Nginx sur la même machine et une connexion Nginx → Node locale.
Si le proxy est distant ou conteneurisé, définir son IP/sous-réseau exact dans
`TRUST_PROXY`. Ne pas utiliser `true`. Nginx doit transmettre `Host`,
`X-Forwarded-For` et `X-Forwarded-Proto`. Ne pas exposer directement le port Node
à Internet ; ne pas désactiver les limites de requêtes.

## Vérification puis redémarrage

```bash
cd /var/www/center-al-hakim
npm run smtp:check
NODE_ENV=production TRUST_PROXY=loopback pm2 restart alhakimcenter --update-env
pm2 logs alhakimcenter --lines 50
```

Utiliser le nom exact retourné par `pm2 list` s'il diffère. Quitter les logs avec
Ctrl+C, sans arrêter le service. Le diagnostic n'envoie aucun e-mail et ne montre
aucun identifiant : il vérifie la connexion, TLS et l'authentification. Une réussite
ne garantit pas la livraison : essayer ensuite une connexion administrateur pour
recevoir un véritable OTP et vérifier les indésirables.

Si le diagnostic échoue, corriger la cause avant de redémarrer : authentification
refusée (identifiants), délai dépassé (port bloqué par l'hébergeur/pare-feu), TLS
(port/certificat), DNS (hôte incorrect). Ne pas désactiver la validation des certificats.
Les lignes déjà écrites dans les logs PM2 restent visibles après le correctif :
regarder les nouvelles lignes lors d'une nouvelle requête.

PM2 et les variables exportées par le shell priment sur `.env`. Si PM2 fournit déjà
les paramètres SMTP, les actualiser aussi dans sa configuration. Utiliser le même
environnement pour le diagnostic et le service.
