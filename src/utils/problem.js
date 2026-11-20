// Format d'erreur RFC 9457 (« Problem Details for HTTP APIs »).
// Avec type "about:blank", title est l'intitulé du code HTTP ; detail décrit le cas précis.
const TITLES = {
  400: "Requête invalide",
  404: "Ressource introuvable",
  409: "Conflit",
  413: "Contenu trop volumineux",
  500: "Erreur interne",
};

export function sendProblem(res, status, detail) {
  res
    .status(status)
    .type("application/problem+json")
    .json({ type: "about:blank", title: TITLES[status] ?? "Erreur", status, detail });
}
