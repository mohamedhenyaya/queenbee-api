// Petites règles de validation partagées par les services.

export const isIsoDate = (v) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lit un paramètre entier : absent -> valeur par défaut ; présent -> entier écrit en
// chiffres, compris entre min et max. Renvoie { valeur } ou { erreur }.
export function parseIntParam(brut, nom, { defaut, min, max }) {
  if (brut === undefined) return { valeur: defaut };
  const valeur = typeof brut === "string" && /^\d+$/.test(brut) ? Number(brut) : NaN;
  if (!Number.isSafeInteger(valeur) || valeur < min || valeur > max) {
    const bornes = max === Infinity ? "un entier positif ou nul" : `un entier compris entre ${min} et ${max}`;
    return { erreur: `Le paramètre ${nom} doit être ${bornes}.` };
  }
  return { valeur };
}
