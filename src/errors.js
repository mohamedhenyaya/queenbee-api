// Erreurs métier : levées par les services, traduites en codes HTTP par errorHandler.
// Les services ne connaissent pas HTTP ; seul l'intergiciel d'erreur choisit le code.

export class NotFoundError extends Error {
  name = "NotFoundError";
}

export class ValidationError extends Error {
  name = "ValidationError";
}

export class ConflictError extends Error {
  name = "ConflictError";
}
