# Queen Bee — API Backend Node.js

## Démarrage

```bash
npm install
npm run dev          # http://localhost:3000
```

Collection de requêtes Postman : `postman/queenbee-api.postman_collection.json`.

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
