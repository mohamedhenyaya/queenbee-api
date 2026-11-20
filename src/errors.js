// Erreurs typées : levées par les services ou par validate, traduites en réponses par errorHandler.
// La classe mère porte le code HTTP ; chaque sous-classe nomme un cas.
export class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name; // « NotFoundError », « ValidationError »…
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

export class NotFoundError extends AppError {
  constructor(message) { super(message, 404); }
}

export class ConflictError extends AppError {
  constructor(message) { super(message, 409); }
}
