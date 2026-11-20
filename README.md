# Queen Bee — API Backend Node.js

## État du livrable du jour 2 (tag `jour2-fin`)

Fait :

- TP 5 : l'API lit et écrit dans PostgreSQL, uniquement avec des requêtes paramétrées. Les temps de l'import ligne à ligne et par lot, et les quatre réponses, sont plus bas.
- TP 6 : toutes les entrées passent par un schéma Joi. Toutes les erreurs suivent la RFC 9457, sans pile d'exécution ni SQL.
- TP 7 :
  - connexion, renouvellement, création de compte par l'administrateur et blocage après 5 échecs ;
  - contrôle par rôle, par site et par propriétaire ;
  - journal des requêtes interdites, plus bas.
- TP 8 : mesures et inspections se rejouent sans doublon. La synchronisation par lot détecte les conflits, et la règle de conflit est plus bas.
- `npm test` passe : 50 tests sur 50.
- `.env` est absent du dépôt et de son historique ; `.env.example` contient de faux secrets.
- La collection Postman passe en entier deux fois de suite (244 assertions sur 244).

Ce qui manque :

- Revue croisée du bilan du jour : les requêtes du groupe voisin qui passent alors qu'elles devraient être refusées seront notées ici.
- TP 3, étape 4 (jour 1) : la relecture du contrat par un groupe voisin n'a pas encore été faite.

## État du livrable du jour 1 (tag `jour1-fin`)

Fait :

- TP 1 : lecture bloquante et en flux, mesures et réponses ci-dessous.
- TP 2 : `GET /health`, `GET /api/hives`, `GET /api/hives/:id`, `POST /api/hives/:id/measures`, journal des requêtes.
- TP 3 : contrat dans [docs/api.md](docs/api.md), mesures paginées, inspections, erreurs au format RFC 9457.
- TP 4 : code en couches, configuration par `.env`, `npm test` au vert (2 tests).
- Collection de requêtes : `postman/queenbee-api.postman_collection.json`, sans jeton ni mot de passe.

Ce qui manque :

- TP 3, étape 4 : la relecture du contrat par un groupe voisin n'a pas encore été faite.

## Démarrage

```bash
npm install
cp .env.example .env   # puis remplacer les fausses valeurs (mot de passe de la base, secrets JWT)
docker compose up -d   # la base PostgreSQL (voir db/README.md)
npm run dev            # http://localhost:3000, recharge à chaque modification
npm test               # tests node:test
```

- Contrat de l'API : [docs/api.md](docs/api.md).
- Collection Postman : `postman/queenbee-api.postman_collection.json` (Import, puis Run dans l'ordre). Elle se connecte elle-même avec les comptes de démonstration (mot de passe `QueenBee2026!`) et range le jeton dans la variable `token`, vide à l'export.
- Configuration (`.env`) : `PORT` (1 à 65535, 3000 par défaut), `NODE_ENV` (`development`, `production` ou `test`), `DB_*` (`DB_PASSWORD` obligatoire, `DB_POOL_MAX` 10 par défaut), `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` (obligatoires et différents), `JWT_ACCESS_TTL` (15m par défaut) et `JWT_REFRESH_TTL` (7d par défaut). Une valeur invalide arrête le démarrage avec un message.

## Architecture

```
src/
  server.js           crée le pool PostgreSQL et les repositories, appelle createApp, puis listen
  app.js              createApp(repositories) : branche services, contrôleurs, routeurs
  config.js           lit PORT, NODE_ENV, DB_* et JWT_*
  db.js               createPool() : pool pg, NUMERIC converti en nombre
  errors.js           AppError et ses sous-classes (400, 401, 403, 404, 409)
  routes/             auth/ et hives/ : URL + verbe -> jeton -> rôle -> validate(schéma) -> contrôleur
  validators/         schémas Joi et messages en français
  controllers/        lit req.user et req.validated, choisit le code HTTP
  services/           règles métier : droits d'accès (canAccessHive), jetons, ruche existante
  repositories/postgres/  une fabrique par table, requêtes paramétrées
  middlewares/        requestLogger, auth (requireAuth, requireRole), validate, notFoundHandler, errorHandler
  utils/problem.js    sendProblem, format d'erreur RFC 9457
test/                 tests des services (faux repositories), des schémas et de la configuration, sans serveur ni base
```

Chaque service est une fabrique qui reçoit ses dépendances (`createMeasuresService({ hivesService, measuresRepository })`) et n'importe jamais de repository. Aucun contrôleur n'importe de repository.

## TP 8 — Synchronisation idempotente

Sur le terrain, l'application mobile enregistre les inspections hors connexion, puis les envoie en lot au retour du réseau. Si la connexion coupe avant la réponse, elle renvoie tout. Le serveur ne crée aucun doublon et n'écrase jamais, sans le dire, une saisie plus récente.

```
src/
  repositories/postgres/measures.repository.js     add : INSERT … ON CONFLICT (hive_id, measured_at) DO NOTHING, puis findOne
  repositories/postgres/inspections.repository.js  insertIfAbsent : ON CONFLICT (id) DO NOTHING ; updateIfVersion : UPDATE … WHERE version = $7
  services/inspections.service.js                  addInspection, syncInspections (syncOne traite un élément sans lever d'erreur métier)
  routes/inspections/, controllers/inspections.controller.js   POST /api/inspections/sync (apiculteur, coordinateur)
  validators/schemas.js                            syncSchema : { inspections: [1 à 500] }, hive_id obligatoire, version facultative
```

- **Idempotence.**
  - Une mesure est reconnue à sa clé (`hive_id`, `measured_at`), une inspection à l'UUID choisi par l'application.
  - Rejouer un envoi renvoie 200 et l'élément déjà enregistré, au lieu de 201. Ce n'est plus une erreur (409 au TP 6, 500 au TP 5).
  - Comme `RETURNING` ne renvoie rien après `ON CONFLICT DO NOTHING`, l'élément est relu en base.
- **Verrouillage optimiste.** Une modification n'est acceptée que si l'appareil envoie la `version` actuelle du serveur, qui passe alors à la suivante. Le `WHERE … AND version = $7` fait la comparaison et l'écriture en une seule requête : deux appareils ne peuvent pas modifier la même version.
- **Lot.** Chaque inspection reçoit son statut : `created`, `unchanged`, `updated`, `conflict` (avec `current`) ou `rejected` (avec `detail`). Une `AppError` sur un élément devient `rejected` sans arrêter le lot. Toute autre erreur remonte, car c'est un bug.
- **Tests :**
  - `inspections.service.test.js` (8 tests) : rejeu sans doublon, conflit sur version périmée, statuts d'un lot, ruche interdite qui n'arrête pas les autres, id pris par une autre ruche, erreur non métier qui remonte ;
  - `measures.service.test.js` : trame reçue deux fois ;
  - `validators.test.js` : lot vide, tableau seul, `hive_id` et `version`, 500 éléments au plus.
- **Collection Postman.** Le dossier « Synchronisation » utilise des UUID neufs à chaque Run, pour rester rejouable. La requête « Sync » envoie `lot.json` tel quel, comme dans l'énoncé.

### Règle de conflit : le serveur l'emporte

Une modification envoyée avec une version périmée est refusée (`conflict`), et la réponse contient l'inspection du serveur (`current`). L'apiculteur voit les deux saisies et choisit quoi garder, puis renvoie sa modification avec `current.version`. Nous écartons « le dernier qui écrit l'emporte » : sur le terrain, l'ordre d'arrivée dépend du réseau et non de l'ordre des saisies, et une observation sanitaire (reine absente, colonie faible) écrasée en silence serait perdue sans que personne le sache.

### Vérifications

Connecté en `api1.sn-casa@queenbee.test`, sur une base neuve :

| Étape | Résultat obtenu |
| ----- | --------------- |
| Inspections de SN-CASA-001 avant le lot | 3 |
| `lot.json`, premier envoi | 200, `created` 3, `rejected` 1 : SN-CASA-011, « Vous n'avez pas accès à la ruche SN-CASA-011. » |
| Inspections de SN-CASA-001 | 4 |
| `lot.json`, second envoi | 200, `unchanged` 3, `rejected` 1 |
| Inspections de SN-CASA-001 | 4 : aucun doublon |
| Troisième inspection, `"version": 1`, `"colony_status": "normale"` | `updated`, `version` 2 |
| La même modification une seconde fois | `conflict`, `current.version` 2, « L'inspection a été modifiée entre-temps : version 2 sur le serveur, 1 sur l'appareil. » |
| `{"inspections": []}` / `lot.json` en admin | 400 « inspections doit contenir au moins 1 élément(s). » / 403 |
| Mesure `2026-11-03T08:00:00Z` deux fois (admin) | 201, puis 200 |
| Inspection `…4e09` deux fois sur SN-CASA-004, puis sur SN-CASA-005 | 201, puis 200, puis 409 |
| `npm test` | 50 tests sur 50 |

## TP 7 — Authentification et autorisation

Chaque requête vers `/api/hives` porte un jeton d'accès JWT (`Authorization: Bearer <jeton>`), et l'API vérifie ce que son utilisateur a le droit de voir et de faire. Le stockage en mémoire est supprimé : l'API a besoin de la table `users` (les repositories en mémoire restent dans le tag `jour1-fin`).

```
src/
  services/auth.service.js           login, refresh, register, verifyAccessToken (bcryptjs, jsonwebtoken)
  repositories/postgres/users.repository.js   seule findByEmail lit password_hash
  middlewares/auth.js                createRequireAuth(authService) -> req.user ; requireRole(...roles)
  controllers/auth.controller.js, routes/auth/auth.router.js   /api/auth/login, refresh, register, me
  services/hives.service.js          canAccessHive(user, hive), listHives(user, …), getHive(user, id)
```

| Rôle | Ruches visibles | Peut envoyer |
| ---- | --------------- | ------------ |
| admin | toutes | des mesures (il simule la passerelle), des comptes |
| gestionnaire | toutes | rien |
| coordinateur | celles de son site | des inspections |
| apiculteur | les siennes (`owner_id`) | des inspections |

- **Jetons.** Le jeton d'accès dure 15 minutes et le jeton de renouvellement 7 jours. Ils sont signés avec deux secrets différents et portent un champ `type` : l'un ne passe jamais pour l'autre. À la vérification, l'algorithme (HS256), l'émetteur et l'audience sont imposés (RFC 8725), donc un jeton `alg: none` est refusé. `refresh` relit l'utilisateur en base, car son rôle a pu changer.
- **Connexion.** Une adresse inconnue et un mauvais mot de passe donnent le même message, dans le même temps (empreinte factice), pour ne pas révéler quelles adresses existent. Au cinquième échec, le compte est bloqué 15 minutes, même si l'essai suivant est le bon.
- **Droits.** La règle d'accès n'est écrite qu'une fois, dans `canAccessHive`. Les services des mesures et des inspections passent tous par `getHive(user, id)`, qui vérifie l'existence d'abord (404), puis les droits (403). Les rôles qui peuvent écrire sont contrôlés dans le routeur (`requireRole`).
- **Auteur d'une inspection.** C'est l'utilisateur du jeton (`user.id`), jamais une valeur du corps. Le `(SELECT owner_id …)` provisoire du TP 5 est supprimé, et `author_id` est renvoyé avec l'inspection.
- **Création de compte.** Elle est réservée à l'administrateur (UC-AD01). `site_id` est obligatoire pour un apiculteur ou un coordinateur, et interdit pour un gestionnaire ou un admin. L'empreinte du mot de passe n'est jamais renvoyée, et une adresse déjà prise donne 409.
- **Journal des refus.** Chaque 401 ou 403 laisse dans le terminal une ligne `[accès refusé]` avec la méthode, l'URL, l'IP et l'utilisateur. Un 401 porte l'en-tête `WWW-Authenticate: Bearer realm="queenbee"`.
- **Tests.** `npm test` passe : 37 tests sur 37.
  - `hives.service.test.js` : `canAccessHive` rôle par rôle, filtres de `listHives`, 404 avant 403.
  - `auth.service.test.js` : même message, blocage au cinquième échec, jetons falsifiés, expirés ou `alg: none`, type de jeton.
  - `config.test.js` : secrets manquants ou identiques.
  - `validators.test.js` : schémas de connexion et de création de compte.
- **Collection Postman.** Elle se connecte elle-même (admin, puis api1, puis le coordinateur, puis le gestionnaire), teste le blocage sur un compte créé pour l'occasion avec une adresse neuve à chaque Run, et contient les requêtes interdites ci-dessous. Elle passe en entier deux fois de suite (209 assertions sur 209). Chaque Run laisse en base un compte `test-blocage-…@queenbee.test`.

### Vérifications

| Vérification | Connecté en | Résultat obtenu |
| ------------ | ----------- | --------------- |
| `GET /api/hives` sans jeton | personne | 401, en-tête `WWW-Authenticate: Bearer realm="queenbee"` |
| Mauvais mot de passe, puis adresse inconnue | personne | 401 les deux fois, même `detail` : « Adresse e-mail ou mot de passe incorrect. » |
| `GET /api/hives` | admin / coord.sn-casa / api1.sn-casa | 400 ruches / 50, toutes de SN-CASA / 10, de SN-CASA-001 à SN-CASA-010 |
| `GET /api/hives/SN-CASA-011`, puis `XX-NOPE-999` | api1.sn-casa | 403 « Vous n'avez pas accès à la ruche SN-CASA-011. », puis 404 |
| Inspection sur SN-CASA-001 | api1.sn-casa | 201, `author_id` égal à l'`id` de `/api/auth/me` ; avec `"author_id": "x"` : 400 |
| Compte créé par `register`, 5 mauvais mots de passe puis le bon | admin, puis personne | 201 ; essais 1 à 4 : « … incorrect. » ; essai 5 et bon mot de passe : « Compte bloqué après 5 échecs de connexion, jusqu'à 11:12 UTC. » |
| `npm test` | | 37 tests sur 37, dont `canAccessHive : chaque rôle voit ce qu'il doit voir` |

### Journal des requêtes interdites

| Requête interdite | Connecté en | Requête | Attendu | Obtenu |
| ----------------- | ----------- | ------- | ------- | ------ |
| Ressource d'un autre site | coord.sn-casa | `GET /api/hives?site_id=CI-AGBO` | 403 | 403 « Vous n'avez pas accès au site CI-AGBO. » |
| Rôle insuffisant | api1.sn-casa | `POST /api/hives/SN-CASA-001/measures` | 403 | 403 « Action réservée aux rôles suivants : admin. » |
| Jeton expiré | gestion | `GET /api/hives` 11 s après la connexion, avec `JWT_ACCESS_TTL=10s` | 401 | 401 « Jeton d'accès invalide ou expiré. » |
| Jeton falsifié | coord.sn-casa | `GET /api/hives`, une lettre changée dans la partie centrale du jeton | 401 | 401 « Jeton d'accès invalide ou expiré. » |

Lignes correspondantes dans le terminal du serveur :

```
[accès refusé] 403 GET /api/hives?site_id=CI-AGBO ip=::1 utilisateur=bbf57177-bb5c-41a5-8242-28b74588b2f3
[accès refusé] 403 POST /api/hives/SN-CASA-001/measures ip=::1 utilisateur=3285e783-75a0-4f52-9f1d-00b375602821
[accès refusé] 401 GET /api/hives ip=::1 utilisateur=-
[accès refusé] 401 GET /api/hives ip=::1 utilisateur=-
```

Pour un jeton expiré ou falsifié, l'utilisateur vaut `-` : le jeton est refusé avant que `req.user` existe.

## TP 6 — Validation et erreurs

Toute entrée passe par un schéma Joi avant d'atteindre un contrôleur ; toute erreur passe par un seul intergiciel.

```
src/
  errors.js                  AppError (porte le code HTTP) : ValidationError 400, NotFoundError 404, ConflictError 409
  validators/schemas.js      hivesQuerySchema, paginationSchema, measureSchema, inspectionSchema
  validators/messages.js     messages de Joi en français (kit du jour 2)
  middlewares/validate.js    validate(schema, "body" | "query") : range le résultat converti dans req.validated
  middlewares/errorHandler.js  AppError, JSON mal formé (400), corps > 1 Mo (413), erreurs PostgreSQL, 500
```

- Le routeur place `validate` avant chaque contrôleur ; les contrôleurs lisent `req.validated` et n'ont aucun `try/catch` (Express 5 transmet les promesses rejetées à `errorHandler`).
- Les services ne vérifient plus que ce qui a besoin de la ruche : elle existe, et le `hive_id` du corps est celui du chemin (mesures et inspections). `src/services/validation.js` est supprimé.
- Erreurs PostgreSQL : `23505` (doublon) devient 409 « Cette ressource existe déjà. » ; `23503`, `23514` et `22P02` deviennent 400 avec un message générique. Le message de PostgreSQL ne va jamais dans la réponse, car il cite des tables et des contraintes.
- Un champ non déclaré est refusé : un client ne peut pas envoyer d'`author_id` dans une inspection.
- Tests : `test/validators.test.js` teste les schémas à travers `validate`, sans serveur (15 tests au TP 6). `test/measures.service.test.js` garde ce qui a besoin du contexte : la ruche inconnue et le `hive_id` différent du chemin. `npm test` au TP 6 : 18 tests sur 18 passent.
- Le contrat [docs/api.md](docs/api.md) et la collection Postman sont à jour. La collection a 6 requêtes de plus (doublon 409, corps vide, deux champs hors plage, JSON mal formé, `author_id`, date future, injection SQL), et la mesure valide prend un instant neuf à chaque Run pour éviter un 409.

Vérifications de l'énoncé, faites sur PostgreSQL :

| Requête | Résultat |
| ------- | -------- |
| Mesure avec `weight_kg: 500` et `humidity_pct: 120` | 400 « weight_kg doit être inférieur ou égal à 150. humidity_pct doit être inférieur ou égal à 100. » |
| Mesure sans corps | 400 « timestamp est obligatoire. weight_kg est obligatoire. » |
| `?limit=abc` / sans `limit` | 400 « limit doit être un nombre. » / 200 avec 50 mesures, `limit` 50, `offset` 0 |
| La même mesure valide deux fois | 201, puis 409 « Cette ressource existe déjà. » (depuis le TP 8 : 201, puis 200) |
| Inspection avec `author_id` | 400 « author_id n'est pas un champ autorisé. » |
| Inspection datée de 2099 | 400 « inspected_at ne peut pas être dans le futur. » |
| JSON mal formé / corps de plus de 1 Mo | 400 / 413 |
| `try {` dans `src/controllers` | aucun résultat |

## TP 5 — Brancher PostgreSQL

`STORAGE=postgres` (par défaut) ou `STORAGE=memory` dans `.env` choisissait le stockage, jusqu'au TP 7 qui a supprimé le mode mémoire. Seuls `config.js`, `server.js`, `db.js` et `repositories/` ont changé : `git diff jour1-fin --stat -- src/services src/controllers src/routes` n'affichait rien au commit du TP 5.

```
src/
  db.js                      createPool() : pool pg, NUMERIC converti en nombre
  repositories/memory/index.js     createMemoryRepositories()
  repositories/postgres/index.js   createPostgresRepositories(pool)
  repositories/postgres/*.repository.js   mêmes méthodes que la version en mémoire
```

Variables ajoutées à `.env` : `STORAGE` (`postgres` ou `memory`), `DB_POOL_MAX` (10 par défaut). `DB_PASSWORD` est obligatoire en mode `postgres`, sans valeur par défaut.

### Insertion en masse (`scripts/import-measures.js`)

4 800 mesures du 31 octobre, premier essai de chaque mode (un second essai donne 15 459 ms et 298 ms). Node.js 24, Windows 11, PostgreSQL 17 dans Docker.

| Mode          | Durée (ms) |
| ------------- | ---------: |
| ligne à ligne |     10 929 |
| par lot       |        221 |

1. **Quel temps dans chaque mode ? D'où vient l'écart ?**
   L'insertion par lot est environ 50 fois plus rapide : 221 ms contre près de 11 s. Ligne à ligne, chaque mesure coûte un aller-retour réseau avec la base et un `COMMIT` implicite, donc une écriture forcée sur disque : 4 800 fois. Par lot, il n'y a que 5 requêtes de 1 000 lignes et un seul `COMMIT`, donc une seule synchronisation du journal sur disque.

2. **Si la 2 001e mesure provoquait une erreur, que resterait-il en base ?**
   Ligne à ligne : les 2 000 premières mesures, déjà validées une par une, restent en base (import à moitié fait). Par lot : rien, le `ROLLBACK` annule toute la transaction, y compris les 2 lots de 1 000 déjà envoyés.

3. **Pourquoi `pool.connect()` au lieu de `pool.query()` ?**
   Une transaction est attachée à une connexion : `BEGIN`, les `INSERT` et le `COMMIT` doivent passer par la même. `pool.query()` peut prêter une connexion différente à chaque appel, et le `BEGIN` serait alors sans effet sur les `INSERT` suivants.

4. **Et si `client.release()` n'était pas dans le `finally`, avec dix erreurs de suite ?**
   Chaque erreur laisserait une connexion empruntée sans jamais la rendre. Après dix erreurs (`DB_POOL_MAX=10`), le pool est vide : toutes les requêtes suivantes attendent une connexion, puis échouent au bout de `connectionTimeoutMillis` (5 s). L'API ne répond plus que par des erreurs 500.

## TP 2 — Journalisation

Deux journaux comparés sur les mêmes requêtes :

```
requestLogger : 2026-11-19T11:04:21.588Z GET /api/hives/XX-NOPE-999 404 0.9 ms
morgan("dev") : GET /x/1?a=b 404 0.688 ms - 2
```

`morgan("dev")` est coloré selon le code de statut et donne la taille de la réponse, mais n'affiche pas la date. Notre `requestLogger` donne la date complète, utile pour retrouver une requête dans le temps, et nous apprend le fonctionnement d'un intergiciel (`res.on("finish")`). **Nous gardons `requestLogger`.**

## TP 1 — Lire les mesures sans bloquer

Routes écrites dans `tp/tp1-lecture/serveur-depart.js` :

- `POST /import/bloquant` lit tout le fichier avec `readFileSync`, puis le parcourt ligne par ligne.
- `POST /import/flux` lit le fichier en flux avec `createReadStream` et `readline` (`for await`).

Les deux routes renvoient les mêmes valeurs : 144 000 mesures et 38,74 kg pour le fichier de 30 jours, 4 800 mesures et 37,87 kg pour celui d'une journée.

### Mesures

Valeur médiane de trois passages de la sonde. Node.js 24, Windows 11.

| Fichier  | Lecture   | Durée de l'import (ms) | Pire temps de /ping (ms) |
| -------- | --------- | ---------------------: | -----------------------: |
| 1 jour   | bloquante |                      7 |                        4 |
| 1 jour   | en flux   |                     12 |                        4 |
| 30 jours | bloquante |                    219 |                      213 |
| 30 jours | en flux   |                    326 |                        5 |

### Questions

1. **Pourquoi /ping attend-il pendant l'import bloquant ?**
   Node exécute le JavaScript sur un seul thread. `readFileSync` puis la boucle de `JSON.parse` occupent ce thread du début à la fin de l'import, donc la boucle d'événements ne peut traiter aucune autre requête : le /ping attend la fin de l'import (environ 210 ms ici).

2. **La lecture en flux est-elle plus rapide ? Sinon, qu'apporte-t-elle ?**
   Non, elle est même un peu plus lente (326 ms contre 219 ms), à cause des allers-retours avec la boucle d'événements entre deux morceaux. Elle apporte la réactivité : le serveur continue de répondre aux autres utilisateurs (/ping en 5 ms au lieu de 213 ms), et la mémoire reste faible car le fichier n'est jamais chargé en entier.

3. **Pourquoi l'effet est-il presque invisible avec le fichier d'une journée ?**
   Le fichier est 30 fois plus petit : l'import bloquant ne dure que 7 ms, moins que l'intervalle de 10 ms entre deux /ping de la sonde. Le blocage est trop court pour qu'un /ping tombe dedans ou attende de façon mesurable.
