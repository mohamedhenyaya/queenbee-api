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
  "detail": "weight_kg doit être inférieur ou égal à 150. humidity_pct doit être inférieur ou égal à 100."
}
```

`title` est l'intitulé du code, identique pour toutes les erreurs de même code ; `detail` explique le cas précis. Quand une requête contient plusieurs erreurs, `detail` les cite toutes. Une réponse d'erreur ne contient jamais de pile d'exécution ni de SQL.

| Code | `title` |
| ---- | ------- |
| 400 | Requête invalide |
| 401 | Authentification requise |
| 403 | Accès refusé |
| 404 | Ressource introuvable |
| 409 | Conflit |
| 413 | Contenu trop volumineux |
| 500 | Erreur interne |

Erreurs communes à toutes les routes :

- **400** : le corps n'est pas un JSON valide (`"detail": "Le corps de la requête n'est pas un JSON valide."`).
- **400** : le corps ou les paramètres de requête contiennent un champ que la route ne prévoit pas (`"detail": "author_id n'est pas un champ autorisé."`).
- **413** : le corps dépasse 1 Mo (`"detail": "Le corps de la requête dépasse la taille maximale de 1 Mo."`).
- **404** : aucune route ne correspond au verbe et au chemin (`"detail": "Aucune route ne correspond à GET /api/nope."`).
- **500** : erreur inattendue du serveur (`"detail": "Une erreur interne est survenue."`).

## Authentification et droits

Toutes les routes `/api/hives…` et `GET /api/auth/me` demandent un jeton d'accès, obtenu par `POST /api/auth/login` :

```
Authorization: Bearer <access_token>
```

Le jeton d'accès dure 15 minutes ; `POST /api/auth/refresh` en donne un nouveau à partir du jeton de renouvellement (7 jours).

- **401** : jeton absent, invalide, falsifié ou expiré. La réponse porte l'en-tête `WWW-Authenticate: Bearer realm="queenbee"`.
  - `"detail": "Jeton d'accès manquant : ajoutez l'en-tête Authorization: Bearer <jeton>."`
  - `"detail": "Jeton d'accès invalide ou expiré."`
- **403** : jeton valide, mais l'utilisateur n'a pas le droit.

| Rôle | Ruches visibles | Peut envoyer |
| ---- | --------------- | ------------ |
| `admin` | toutes | des mesures (il simule la passerelle), des comptes |
| `gestionnaire` | toutes | rien |
| `coordinateur` | celles de son site | des inspections |
| `apiculteur` | les siennes (`owner_id`) | des inspections |

Envoyer avec un rôle qui n'en a pas le droit : **403** `"Action réservée aux rôles suivants : admin."`.

## Paramètre de chemin commun

- `id` : identifiant d'une ruche, texte, par exemple `SN-CASA-001`. Si aucune ruche ne porte cet identifiant, toutes les routes `/api/hives/:id…` répondent **404**. Si elle existe mais que l'utilisateur n'y a pas accès, elles répondent **403** (`"detail": "Vous n'avez pas accès à la ruche SN-CASA-011."`). L'existence est vérifiée avant les droits.

---

### POST /api/auth/login

Public. Échange une adresse et un mot de passe contre deux jetons.

```json
{ "email": "admin@queenbee.test", "password": "QueenBee2026!" }
```

**200**

```json
{ "token_type": "Bearer", "access_token": "eyJ…", "refresh_token": "eyJ…" }
```

**400** : `email` ou `password` manque, ou `email` n'est pas une adresse valide.

**401** :

- adresse inconnue ou mot de passe faux : le même message dans les deux cas, pour ne pas révéler quelles adresses ont un compte (`"detail": "Adresse e-mail ou mot de passe incorrect."`) ;
- compte bloqué : au cinquième échec de suite, le compte est bloqué 15 minutes, même avec le bon mot de passe (`"detail": "Compte bloqué après 5 échecs de connexion, jusqu'à 11:12 UTC."`).

---

### POST /api/auth/refresh

Public. Donne une nouvelle paire de jetons. Le rôle et le site sont relus en base.

```json
{ "refresh_token": "eyJ…" }
```

**200** : même forme que `POST /api/auth/login`.

**400** : `refresh_token` manque.

**401** : jeton de renouvellement invalide ou expiré, ou jeton d'accès envoyé à la place (`"detail": "Jeton de renouvellement invalide ou expiré."`).

---

### POST /api/auth/register

Réservée au rôle `admin` (UC-AD01). Crée un compte.

| Champ | Type | Obligatoire |
| ----- | ---- | ----------- |
| `email` | adresse e-mail | oui ; enregistrée en minuscules |
| `password` | texte de 12 à 72 caractères | oui |
| `role` | `apiculteur`, `coordinateur`, `gestionnaire` ou `admin` | oui |
| `site_id` | texte | obligatoire pour `apiculteur` et `coordinateur`, interdit pour `gestionnaire` et `admin` |

**201** : le compte, sans l'empreinte du mot de passe.

```json
{ "id": "2253a0d3-…", "email": "nouveau@queenbee.test", "role": "gestionnaire", "site_id": null, "created_at": "2026-11-20T10:57:32.150Z" }
```

**400** : corps invalide, ou `site_id` inconnu. **401** : pas de jeton. **403** : l'utilisateur n'est pas admin. **409** : adresse déjà utilisée (`"detail": "Cette ressource existe déjà."`).

---

### GET /api/auth/me

Connecté. L'utilisateur du jeton.

**200**

```json
{ "id": "3285e783-…", "role": "apiculteur", "site_id": "SN-CASA" }
```

**401** : jeton absent, invalide ou expiré.

---

### GET /health

Indique que le serveur répond. Public : aucun jeton.

Paramètres : aucun.

**200**

```json
{ "status": "ok" }
```

Erreur : aucune propre à cette route.

---

### GET /api/hives

Liste des ruches que l'utilisateur peut voir : toutes pour `admin` et `gestionnaire`, celles de son site pour un `coordinateur`, les siennes pour un `apiculteur`.

Paramètres de requête :

- `site_id` : texte, facultatif. Ne garde que les ruches de ce site. Absent ou vide (`?site_id=`) : pas de filtre. Un site inconnu donne une liste vide.

**200**

```json
[
  { "id": "SN-CASA-001", "site_id": "SN-CASA", "owner_id": "3285e783-…", "ref_lat": 12.5743, "ref_lon": -16.2873, "status": "active" },
  { "id": "SN-CASA-002", "site_id": "SN-CASA", "owner_id": "3285e783-…", "ref_lat": 12.5751, "ref_lon": -16.2869, "status": "active" }
]
```

**403** : un coordinateur demande un autre site que le sien (`"detail": "Vous n'avez pas accès au site CI-AGBO."`).

---

### GET /api/hives/:id

Une ruche.

**200**

```json
{ "id": "SN-CASA-001", "site_id": "SN-CASA", "owner_id": "3285e783-…", "ref_lat": 12.5743, "ref_lon": -16.2873, "status": "active" }
```

**403** : la ruche existe, mais l'utilisateur n'y a pas accès.

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

Réservée au rôle `admin`, qui simule la passerelle (403 pour les autres rôles). Enregistre une mesure envoyée par la passerelle d'un site (trame du § 6.5). La mesure garde le `timestamp` de la trame : l'instant où le capteur l'a prise, pas celui de la réception.

Corps :

| Champ | Type | Obligatoire |
| ----- | ---- | ----------- |
| `timestamp` | date ISO 8601 | oui |
| `weight_kg` | nombre | oui |
| `hive_id` | texte | non ; s'il est présent, il doit être égal à `:id` |
| `site_id` | texte | non ; remplacé par le site de la ruche |
| `position_lat`, `position_lon` | nombre | non |
| `temp_internal_c`, `temp_external_c` | nombre | non |
| `humidity_pct`, `battery_pct` | entier | non |
| `acoustic_activity_score` | nombre | non |

Les champs facultatifs peuvent valoir `null`.

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

**200** : une mesure existait déjà pour cette ruche à ce `timestamp` (trame renvoyée par la passerelle après une coupure). Rien n'est modifié, et le serveur renvoie la mesure déjà enregistrée. Envoyer deux fois la même trame ne crée donc pas de doublon et n'est pas une erreur.

**400** :

- `timestamp` ou `weight_kg` manque ;
- `timestamp` n'est pas une date ISO 8601 valide ;
- un champ numérique n'est pas un nombre, ou `humidity_pct` / `battery_pct` n'est pas un entier ;
- un champ numérique sort de sa plage physique (UC-CY02, bornes incluses) :

  | Champ | Min | Max |
  | ----- | --: | --: |
  | `position_lat` | -90 | 90 |
  | `position_lon` | -180 | 180 |
  | `weight_kg` | 0 | 150 |
  | `temp_internal_c` | -10 | 60 |
  | `temp_external_c` | -20 | 60 |
  | `humidity_pct` | 0 | 100 |
  | `acoustic_activity_score` | 0 | 1 |
  | `battery_pct` | 0 | 100 |

  Exemple : `"detail": "weight_kg doit être inférieur ou égal à 150."` ;
- `hive_id` est présent mais différent de `:id`.

Dans ce cas, rien n'est enregistré.

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "timestamp est obligatoire. weight_kg est obligatoire."
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

**400** : `limit` ou `offset` invalide, ou paramètre inconnu.

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "limit doit être un nombre."
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
    "author_id": "3285e783-75a0-4f52-9f1d-00b375602821",
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

Réservée aux rôles `apiculteur` et `coordinateur` (403 pour les autres), sur une ruche à laquelle l'utilisateur a accès. Enregistre une inspection saisie sur l'application mobile, éventuellement hors connexion. L'identifiant est un UUID choisi par l'application, pas par le serveur. L'auteur (`author_id`) est l'utilisateur du jeton.

Corps :

| Champ | Type | Obligatoire |
| ----- | ---- | ----------- |
| `id` | UUID | oui |
| `inspected_at` | date ISO 8601 | oui |
| `colony_status` | `forte`, `normale`, `faible` ou `morte` | oui |
| `hive_id` | texte | non ; s'il est présent, il doit être égal à `:id` |
| `queen_present` | booléen | non, `null` par défaut |
| `observations` | texte de 2 000 caractères au plus | non, `null` par défaut |

Tout autre champ est refusé : l'auteur (`author_id`) n'est jamais choisi par le client.

```json
{
  "id": "6f1c2b9e-3d4a-4f5b-9c8d-7e6f5a4b3c2d",
  "inspected_at": "2026-10-31T09:30:00Z",
  "colony_status": "forte",
  "queen_present": true,
  "observations": "Couvain compact, réserves correctes."
}
```

**201** : l'inspection créée, avec `hive_id`, `author_id`, `version` (1), `created_at` et `updated_at` (heure de réception par le serveur). Même forme que dans `GET /api/hives/:id/inspections`.

**200** : une inspection portant déjà cet `id` a été reçue pour cette ruche (synchronisation rejouée). Le serveur renvoie l'inspection existante sans créer de doublon ni la modifier.

**400** :

- un champ obligatoire manque ;
- `id` n'est pas un UUID ;
- `inspected_at` n'est pas une date ISO 8601 valide, ou est dans le futur ;
- `colony_status` n'est pas une des quatre valeurs ;
- `queen_present` n'est pas un booléen, ou `observations` n'est pas un texte ou dépasse 2 000 caractères ;
- un champ non prévu est présent (par exemple `author_id`) ;
- `hive_id` est présent mais différent de `:id`.

```json
{
  "type": "about:blank",
  "title": "Requête invalide",
  "status": 400,
  "detail": "inspected_at ne peut pas être dans le futur."
}
```

**404** : aucune ruche ne porte cet identifiant.

**409** : cet `id` est déjà utilisé par une inspection d'une autre ruche.

Cette route ne modifie jamais une inspection : pour modifier, passer par `POST /api/inspections/sync` avec la `version` connue.

---

### POST /api/inspections/sync

Réservée aux rôles `apiculteur` et `coordinateur` (403 pour les autres). Synchronise un lot d'inspections saisies hors connexion. L'application peut renvoyer le même lot autant de fois que nécessaire, par exemple après une coupure avant la réponse : cela ne crée aucun doublon (idempotence).

Corps : un objet `{ "inspections": [ … ] }` de 1 à 500 éléments. Chaque élément a les champs de `POST /api/hives/:id/inspections`, plus :

| Champ | Type | Obligatoire |
| ----- | ---- | ----------- |
| `hive_id` | texte | oui |
| `version` | entier ≥ 1 | non ; seulement pour **modifier** une inspection déjà synchronisée : la version que l'appareil connaît |

```json
{
  "inspections": [
    { "id": "6f1d2c3a-1b2c-4d5e-8f60-0a1b2c3d4e01", "hive_id": "SN-CASA-001", "inspected_at": "2026-11-02T08:15:00Z", "colony_status": "forte" },
    { "id": "6f1d2c3a-1b2c-4d5e-8f60-0a1b2c3d4e03", "hive_id": "SN-CASA-003", "inspected_at": "2026-11-02T09:05:00Z", "colony_status": "normale", "version": 1 }
  ]
}
```

Les inspections sont traitées une par une, dans l'ordre. Chacune reçoit son propre statut, et une inspection refusée n'empêche pas les autres :

| Cas | `status` | Champs en plus |
| --- | -------- | -------------- |
| Sans `version`, `id` encore inconnu | `created` | `version` (1) |
| Sans `version`, `id` déjà reçu pour cette ruche | `unchanged` | `version` (celle du serveur) ; rien n'est modifié |
| `version` égale à celle du serveur | `updated` | `version` : la nouvelle (+1) |
| `version` périmée : l'inspection a été modifiée entre-temps | `conflict` | `detail`, et `current` : l'inspection telle qu'elle est sur le serveur, qui n'est pas modifiée |
| Ruche inconnue ou hors des droits, `id` pris par une autre ruche, `version` sur une inspection inconnue | `rejected` | `detail` |

Règle de conflit : le serveur l'emporte. Une modification périmée n'écrase jamais la donnée du serveur ; l'appareil reçoit `current` et l'apiculteur choisit quoi garder, puis renvoie sa modification avec `current.version`.

**200** : toujours, si le lot est bien formé ; le détail est dans `results`.

```json
{
  "summary": { "created": 3, "unchanged": 0, "updated": 0, "conflict": 0, "rejected": 1 },
  "results": [
    { "id": "6f1d2c3a-1b2c-4d5e-8f60-0a1b2c3d4e01", "status": "created", "version": 1 },
    { "id": "6f1d2c3a-1b2c-4d5e-8f60-0a1b2c3d4e04", "status": "rejected", "detail": "Vous n'avez pas accès à la ruche SN-CASA-011." }
  ]
}
```

Un conflit :

```json
{
  "id": "6f1d2c3a-1b2c-4d5e-8f60-0a1b2c3d4e03",
  "status": "conflict",
  "detail": "L'inspection a été modifiée entre-temps : version 2 sur le serveur, 1 sur l'appareil.",
  "current": { "id": "6f1d2c3a-1b2c-4d5e-8f60-0a1b2c3d4e03", "hive_id": "SN-CASA-003", "colony_status": "normale", "version": 2, "…": "…" }
}
```

**400** : lot vide (`"detail": "inspections doit contenir au moins 1 élément(s)."`), plus de 500 éléments, tableau envoyé sans l'objet `{ "inspections": … }` (`"detail": "value doit être un objet JSON."`), ou un élément invalide (le lot entier est alors refusé, rien n'est enregistré).

**401** : pas de jeton. **403** : rôle autre que `apiculteur` ou `coordinateur`.
