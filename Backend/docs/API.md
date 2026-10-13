# API AL-HAKIM CENTER

Base locale : `http://127.0.0.1:4100/api`.

| Méthode | Route                                   | Fonction                                                |
| ------- | --------------------------------------- | ------------------------------------------------------- |
| GET     | `/health`                               | Disponibilité de l’API et de l’enregistrement MongoDB   |
| GET     | `/centre`                               | Coordonnées et départements                             |
| GET     | `/content`                              | Contenu des pages, navigation et FAQ                    |
| GET     | `/courses`                              | Catalogue public                                        |
| GET     | `/courses?department=langues&q=anglais` | Filtre par département et recherche                     |
| GET     | `/courses/:id`                          | Détail d’une formation                                  |
| POST    | `/requests`                             | Demande de formation, d’entreprise ou de renseignements |

## Exemple de demande

```json
{
  "name": "Prénom Nom",
  "email": "visiteur@example.com",
  "phone": "+253 77 00 00 00",
  "kind": "registration",
  "courseId": "anglais",
  "schedule": "soir",
  "message": "Je souhaite connaître les modalités de cette formation.",
  "consent": true,
  "website": ""
}
```

- `kind` : `registration`, `enterprise` ou `contact`.
- `schedule` : `matin`, `soir`, `week-end` ou `flexible`.
- `courseId` est obligatoire et doit correspondre au catalogue pour une demande de formation.
- `consent` doit être `true`.
- `website` est un champ antispam, à laisser vide.
- La requête accepte seulement les champs prévus, avec une taille et des longueurs limitées.

Après un enregistrement réussi, le statut est **201** et la réponse contient `reference` et `message`. Un formulaire invalide renvoie **400** ; un programme inconnu en lecture renvoie **404** ; un service de stockage indisponible renvoie **503** ; trop de requêtes renvoie **429**.

Les demandes ne sont pas exposées par une route publique. Elles sont consultables dans votre base MongoDB, collection `requests`, à l’aide de MongoDB Compass ou de vos outils d’administration autorisés.
