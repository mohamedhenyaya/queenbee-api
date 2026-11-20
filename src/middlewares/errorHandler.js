import { sendProblem } from "../utils/problem.js";
import { AppError } from "../errors.js";

// Codes d'erreur PostgreSQL traduits en 400 : clé étrangère inconnue (23503),
// contrainte CHECK violée (23514), valeur au mauvais format pour son type (22P02).
const PG_INVALID_INPUT = ["23503", "23514", "22P02"];

// Route inconnue : un 404 au format RFC 9457, au lieu de la page HTML d'Express.
export function notFoundHandler(req, res) {
  sendProblem(res, 404, `Aucune route ne correspond à ${req.method} ${req.originalUrl}.`);
}

// Intergiciel d'erreur central : toute erreur arrive ici (Express 5 y envoie aussi les
// promesses rejetées). Les quatre paramètres sont obligatoires : c'est à eux qu'Express
// reconnaît un intergiciel d'erreur.
// Le message d'une erreur PostgreSQL ne va jamais dans la réponse : il cite des tables
// et des contraintes. Il reste dans le journal du serveur.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Erreurs de l'application : leur message est écrit pour le client.
  if (err instanceof AppError) {
    // Journal des requêtes interdites : chaque refus laisse une trace côté serveur.
    if (err.status === 401 || err.status === 403) {
      console.warn(`[accès refusé] ${err.status} ${req.method} ${req.originalUrl} ip=${req.ip} utilisateur=${req.user?.id ?? "-"}`);
    }
    if (err.status === 401) {
      res.set("WWW-Authenticate", 'Bearer realm="queenbee"'); // schéma attendu (RFC 6750)
    }
    return sendProblem(res, err.status, err.message);
  }

  // Erreurs de express.json()
  if (err.type === "entity.parse.failed") {
    return sendProblem(res, 400, "Le corps de la requête n'est pas un JSON valide.");
  }
  if (err.type === "entity.too.large") {
    return sendProblem(res, 413, "Le corps de la requête dépasse la taille maximale de 1 Mo.");
  }

  // Erreurs de PostgreSQL
  if (err.code === "23505") return sendProblem(res, 409, "Cette ressource existe déjà.");
  if (PG_INVALID_INPUT.includes(err.code)) {
    return sendProblem(res, 400, "Une valeur envoyée est invalide ou désigne une ressource inexistante.");
  }

  console.error(err); // la pile va dans le journal du serveur, jamais dans la réponse
  sendProblem(res, 500, "Une erreur interne est survenue.");
}
