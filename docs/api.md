# Contrat de l'API Queen Bee — v0

URL de base : `http://localhost:3000`. Toutes les réponses sont en JSON (UTF-8). Les dates suivent la norme ISO 8601 en UTC, par exemple `2026-10-31T10:00:00Z`.

Les requêtes qui envoient un corps doivent porter l'en-tête `Content-Type: application/json`.

## Format des erreurs (RFC 9457)

Toute erreur est renvoyée avec l'en-tête `Content-Type: application/problem+json` et ce corps :

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "Le paramètre limit doit être un entier compris entre 1 et 500."
}
```

`title` est l'intitulé du code, identique pour toutes les erreurs de même code ; `detail` explique le cas précis. Une réponse d'erreur ne contient jamais de pile d'exécution.

| Code | `title` |
| ---- | ------- |
| 400 | Requête invalide |
| 404 | Ressource introuvable |
| 409 | Conflit |
| 500 | Erreur interne |

Erreurs communes à toutes les routes :

- **400** : le corps n'est pas un JSON valide (`"detail": "Le corps de la requête n'est pas un JSON valide."`).
- **404** : aucune route ne correspond au verbe et au chemin (`"detail": "Aucune route ne correspond à GET /api/nope."`).
- **500** : erreur inattendue du serveur (`"detail": "Une erreur interne est survenue."`).

## Paramètre de chemin commun

- `id` : identifiant d'une ruche, texte, par exemple `SN-CASA-001`. Si aucune ruche ne porte cet identifiant, toutes les routes `/api/hives/:id…` répondent **404**.

---

### GET /health

Indique que le serveur répond.

Paramètres : aucun.

**200**

```json
{ "status": "ok" }
```

Erreur : aucune propre à cette route.

---

### GET /api/hives

Liste des ruches.

Paramètres de requête :

- `site_id` : texte, facultatif. Ne garde que les ruches de ce site. Absent ou vide (`?site_id=`) : toutes les ruches. Un site inconnu donne une liste vide.

**200**

```json
[
  { "id": "SN-CASA-001", "site_id": "SN-CASA", "status": "active" },
  { "id": "SN-CASA-002", "site_id": "SN-CASA", "status": "active" }
]
```

Erreur : aucune propre à cette route.

---

### GET /api/hives/:id

Une ruche.

**200**

```json
{ "id": "SN-CASA-001", "site_id": "SN-CASA", "status": "active" }
```

**404** : aucune ruche ne porte cet identifiant.

```json
{
  "type": "about:blank",
  "title": "Ressource introuvable",
  "status": 404,
  "detail": "Aucune ruche ne porte l'identifiant XX-NOPE-999."
}
```

---

### POST /api/hives/:id/measures

Enregistre une mesure envoyée par la passerelle d'un site (trame du § 6.5). La mesure garde le `timestamp` de la trame : l'instant où le capteur l'a prise, pas celui de la réception.

Corps :

| Champ | Type | Obligatoire |
| ----- | ---- | ----------- |
| `timestamp` | date ISO 8601 | oui |
| `weight_kg` | nombre | oui |
| `hive_id` | texte | non ; s'il est présent, il doit être égal à `:id` |
| `site_id` | texte | non ; remplacé par le site de la ruche |
| `position_lat`, `position_lon` | nombre | non |
| `temp_internal_c`, `temp_external_c` | nombre | non |
| `humidity_pct`, `battery_pct` | nombre | non |
| `acoustic_activity_score` | nombre | non |

```json
{
  "hive_id": "SN-CASA-001",
  "site_id": "SN-CASA",
  "timestamp": "2026-10-31T10:00:00Z",
  "position_lat": 12.5743,
  "position_lon": -16.2873,
  "weight_kg": 36.84,
  "temp_internal_c": 34.4,
  "temp_external_c": 27.1,
  "humidity_pct": 64,
  "acoustic_activity_score": 0.42,
  "battery_pct": 88
}
```

**201** : la mesure enregistrée, telle qu'elle sera relue (`hive_id` et `site_id` sont ceux de la ruche).

**400** :

- `timestamp` ou `weight_kg` manque ;
- `timestamp` n'est pas une date ISO 8601 valide ;
- un champ numérique n'est pas un nombre ;
- `hive_id` est présent mais différent de `:id`.

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "Les champs timestamp et weight_kg sont obligatoires."
}
```

**404** : aucune ruche ne porte cet identifiant.

---

### GET /api/hives/:id/measures

Historique des mesures d'une ruche, de la plus récente à la plus ancienne (tri sur `timestamp`).

Paramètres de requête :

- `limit` : entier de 1 à 500, **50** par défaut ;
- `offset` : entier positif ou nul, **0** par défaut. Nombre de mesures sautées : la page `offset=50` commence juste après la page `offset=0&limit=50`.

Un paramètre présent doit être valide : `?limit=` (vide), `?limit=abc`, `?limit=1.5` ou `?limit=0` donnent 400.

**200**

```json
{
  "items": [
    { "hive_id": "SN-CASA-001", "site_id": "SN-CASA", "timestamp": "2026-10-31T23:45:00Z", "weight_kg": 36.86, "…": "…" }
  ],
  "limit": 50,
  "offset": 0
}
```

`items` est vide si `offset` dépasse le nombre de mesures.

**400** : `limit` ou `offset` invalide.

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "Le paramètre limit doit être un entier compris entre 1 et 500."
}
```

**404** : aucune ruche ne porte cet identifiant.

---

### GET /api/hives/:id/inspections

Inspections d'une ruche, de la plus récente à la plus ancienne (tri sur `inspected_at`).

Paramètres : aucun en dehors de `:id`.

**200**

```json
[
  {
    "id": "6f1c2b9e-3d4a-4f5b-9c8d-7e6f5a4b3c2d",
    "hive_id": "SN-CASA-001",
    "inspected_at": "2026-10-31T09:30:00Z",
    "colony_status": "forte",
    "queen_present": true,
    "observations": "Couvain compact, réserves correctes.",
    "version": 1,
    "created_at": "2026-11-19T11:30:00.000Z",
    "updated_at": "2026-11-19T11:30:00.000Z"
  }
]
```

**404** : aucune ruche ne porte cet identifiant.

---

### POST /api/hives/:id/inspections

Enregistre une inspection saisie sur l'application mobile, éventuellement hors connexion. L'identifiant est un UUID choisi par l'application, pas par le serveur.

Corps :

| Champ | Type | Obligatoire |
| ----- | ---- | ----------- |
| `id` | UUID | oui |
| `inspected_at` | date ISO 8601 | oui |
| `colony_status` | `forte`, `normale`, `faible` ou `morte` | oui |
| `queen_present` | booléen | non, `null` par défaut |
| `observations` | texte | non, `null` par défaut |

```json
{
  "id": "6f1c2b9e-3d4a-4f5b-9c8d-7e6f5a4b3c2d",
  "inspected_at": "2026-10-31T09:30:00Z",
  "colony_status": "forte",
  "queen_present": true,
  "observations": "Couvain compact, réserves correctes."
}
```

**201** : l'inspection créée, avec `hive_id`, `version` (1), `created_at` et `updated_at` (heure de réception par le serveur). Même forme que dans `GET /api/hives/:id/inspections`.

**200** : une inspection portant déjà cet `id` a été reçue pour cette ruche (synchronisation rejouée). Le serveur renvoie l'inspection existante sans créer de doublon ni la modifier.

**400** :

- un champ obligatoire manque ;
- `id` n'est pas un UUID ;
- `inspected_at` n'est pas une date ISO 8601 valide ;
- `colony_status` n'est pas une des quatre valeurs ;
- `queen_present` n'est pas un booléen, ou `observations` n'est pas un texte.

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "Le champ colony_status doit valoir forte, normale, faible ou morte."
}
```

**404** : aucune ruche ne porte cet identifiant.

**409** : cet `id` est déjà utilisé par une inspection d'une autre ruche.
