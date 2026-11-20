# Queen Bee — API Backend Node.js

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
cp .env.example .env   # puis remplacer les fausses valeurs
npm run dev            # http://localhost:3000, recharge à chaque modification
npm test               # tests node:test
```

- Contrat de l'API : [docs/api.md](docs/api.md).
- Collection Postman : `postman/queenbee-api.postman_collection.json` (Import, puis Run dans l'ordre).
- Configuration (`.env`) : `PORT` (1 à 65535, 3000 par défaut) et `NODE_ENV` (`development`, `production` ou `test`). Une valeur invalide arrête le démarrage avec un message.

## Architecture (TP 4)

```
src/
  server.js           choisit le stockage (STORAGE), crée les repositories, appelle createApp, puis listen
  app.js              createApp(repositories) : branche services, contrôleur, routeur
  config.js           lit PORT, NODE_ENV, STORAGE et DB_*
  errors.js           AppError et ses sous-classes NotFoundError, ValidationError, ConflictError
  routes/hives/       URL + verbe -> validate(schéma) -> méthode du contrôleur
  validators/         schémas Joi et messages en français
  controllers/        lit req.validated, choisit le code HTTP
  services/           règles métier qui ont besoin des données (la ruche existe, hive_id cohérent)
  repositories/       memory/ (en mémoire) et postgres/ (PostgreSQL), mêmes méthodes
  middlewares/        requestLogger, validate, notFoundHandler, errorHandler
  utils/problem.js    sendProblem, format d'erreur RFC 9457
test/                 tests des services (faux repositories) et des schémas (sans serveur)
```

Chaque service est une fabrique qui reçoit ses dépendances (`createMeasuresService({ hivesService, measuresRepository })`) et n'importe jamais de repository. Aucun contrôleur n'importe de repository : seuls les repositories changeront au jour 2 (PostgreSQL).

Au démarrage, l'API charge 5 ruches et les mesures du 31 octobre des ruches SN-CASA (fichier `data/mesures-SN-CASA-2026-10-31.ndjson`). Les données sont perdues à chaque redémarrage.

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
- Tests : `test/validators.test.js` teste les schémas à travers `validate`, sans serveur (15 tests). `test/measures.service.test.js` garde ce qui a besoin du contexte : la ruche inconnue et le `hive_id` différent du chemin. `npm test` : 18 tests sur 18 passent.
- Le contrat [docs/api.md](docs/api.md) et la collection Postman sont à jour. La collection a 6 requêtes de plus (doublon 409, corps vide, deux champs hors plage, JSON mal formé, `author_id`, date future, injection SQL), et la mesure valide prend un instant neuf à chaque Run pour éviter un 409.

Vérifications de l'énoncé, faites sur PostgreSQL :

| Requête | Résultat |
| ------- | -------- |
| Mesure avec `weight_kg: 500` et `humidity_pct: 120` | 400 « weight_kg doit être inférieur ou égal à 150. humidity_pct doit être inférieur ou égal à 100. » |
| Mesure sans corps | 400 « timestamp est obligatoire. weight_kg est obligatoire. » |
| `?limit=abc` / sans `limit` | 400 « limit doit être un nombre. » / 200 avec 50 mesures, `limit` 50, `offset` 0 |
| La même mesure valide deux fois | 201, puis 409 « Cette ressource existe déjà. » |
| Inspection avec `author_id` | 400 « author_id n'est pas un champ autorisé. » |
| Inspection datée de 2099 | 400 « inspected_at ne peut pas être dans le futur. » |
| JSON mal formé / corps de plus de 1 Mo | 400 / 413 |
| `try {` dans `src/controllers` | aucun résultat |

## TP 5 — Brancher PostgreSQL

`STORAGE=postgres` (par défaut) ou `STORAGE=memory` dans `.env` choisit le stockage. Seuls `config.js`, `server.js`, `db.js` et `repositories/` ont changé : `git diff jour1-fin --stat -- src/services src/controllers src/routes` n'affiche rien.

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
