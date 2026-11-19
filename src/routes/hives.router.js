import { Router } from "express";
import { hives, measures, inspections } from "../data/memory.js";
import { sendProblem } from "../utils/problem.js";

// Routeur monté sur /api/hives dans app.js : les chemins ici sont relatifs ("/", "/:id").
const router = Router();

const NUMERIC_FIELDS = [
  "weight_kg",
  "position_lat",
  "position_lon",
  "temp_internal_c",
  "temp_external_c",
  "humidity_pct",
  "acoustic_activity_score",
  "battery_pct",
];

const findHive = (id) => hives.find((h) => h.id === id);
const hiveNotFound = (res, id) => sendProblem(res, 404, `Aucune ruche ne porte l'identifiant ${id}.`);
const isIsoDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

// GET /api/hives et GET /api/hives?site_id=SN-CASA
// Un filtre se lit dans req.query, jamais dans le chemin de la route.
router.get("/", (req, res) => {
  const { site_id } = req.query;
  // ?site_id= (chaîne vide) est traité comme l'absence de filtre.
  const resultat = site_id ? hives.filter((h) => h.site_id === site_id) : hives;
  res.json(resultat);
});

// GET /api/hives/:id
router.get("/:id", (req, res) => {
  const hive = findHive(req.params.id);
  if (!hive) return hiveNotFound(res, req.params.id);
  res.json(hive);
});

// POST /api/hives/:id/measures : enregistre une trame envoyée par la passerelle (§ 6.5).
router.post("/:id/measures", (req, res) => {
  const hive = findHive(req.params.id);
  if (!hive) return hiveNotFound(res, req.params.id);

  const body = req.body ?? {};
  if (body.timestamp === undefined || body.weight_kg === undefined) {
    return sendProblem(res, 400, "Les champs timestamp et weight_kg sont obligatoires.");
  }
  if (!isIsoDate(body.timestamp)) {
    return sendProblem(res, 400, "Le champ timestamp doit être une date ISO 8601, par exemple 2026-10-31T10:00:00Z.");
  }
  for (const champ of NUMERIC_FIELDS) {
    if (body[champ] !== undefined && !Number.isFinite(body[champ])) {
      return sendProblem(res, 400, `Le champ ${champ} doit être un nombre.`);
    }
  }
  if (body.hive_id !== undefined && body.hive_id !== hive.id) {
    return sendProblem(res, 400, `Le hive_id du corps (${body.hive_id}) ne correspond pas à la ruche ${hive.id}.`);
  }

  // On garde le timestamp de la trame : l'instant de la mesure, pas celui de la réception.
  const measure = { ...body, hive_id: hive.id, site_id: hive.site_id };
  measures.push(measure);
  res.status(201).json(measure);
});

// Lit un paramètre entier de req.query : absent -> valeur par défaut ;
// présent -> doit être un entier écrit en chiffres, compris entre min et max.
function readIntParam(query, nom, { defaut, min, max }) {
  const brut = query[nom];
  if (brut === undefined) return { valeur: defaut };
  const valeur = typeof brut === "string" && /^\d+$/.test(brut) ? Number(brut) : NaN;
  if (!Number.isSafeInteger(valeur) || valeur < min || valeur > max) {
    const bornes = max === Infinity ? "un entier positif ou nul" : `un entier compris entre ${min} et ${max}`;
    return { erreur: `Le paramètre ${nom} doit être ${bornes}.` };
  }
  return { valeur };
}

// GET /api/hives/:id/measures?limit=50&offset=0 : de la plus récente à la plus ancienne.
router.get("/:id/measures", (req, res) => {
  const hive = findHive(req.params.id);
  if (!hive) return hiveNotFound(res, req.params.id);

  const limit = readIntParam(req.query, "limit", { defaut: 50, min: 1, max: 500 });
  if (limit.erreur) return sendProblem(res, 400, limit.erreur);
  const offset = readIntParam(req.query, "offset", { defaut: 0, min: 0, max: Infinity });
  if (offset.erreur) return sendProblem(res, 400, offset.erreur);

  const items = measures
    .filter((m) => m.hive_id === hive.id)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(offset.valeur, offset.valeur + limit.valeur);

  res.json({ items, limit: limit.valeur, offset: offset.valeur });
});

// GET /api/hives/:id/inspections : de la plus récente à la plus ancienne.
router.get("/:id/inspections", (req, res) => {
  const hive = findHive(req.params.id);
  if (!hive) return hiveNotFound(res, req.params.id);

  const items = inspections
    .filter((i) => i.hive_id === hive.id)
    .sort((a, b) => Date.parse(b.inspected_at) - Date.parse(a.inspected_at));
  res.json(items);
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLONY_STATUSES = ["forte", "normale", "faible", "morte"];

// POST /api/hives/:id/inspections : l'id est un UUID choisi par l'application mobile.
router.post("/:id/inspections", (req, res) => {
  const hive = findHive(req.params.id);
  if (!hive) return hiveNotFound(res, req.params.id);

  const body = req.body ?? {};
  for (const champ of ["id", "inspected_at", "colony_status"]) {
    if (body[champ] === undefined) {
      return sendProblem(res, 400, `Le champ ${champ} est obligatoire.`);
    }
  }
  if (typeof body.id !== "string" || !UUID.test(body.id)) {
    return sendProblem(res, 400, "Le champ id doit être un UUID.");
  }
  if (!isIsoDate(body.inspected_at)) {
    return sendProblem(res, 400, "Le champ inspected_at doit être une date ISO 8601, par exemple 2026-10-31T09:30:00Z.");
  }
  if (!COLONY_STATUSES.includes(body.colony_status)) {
    return sendProblem(res, 400, "Le champ colony_status doit valoir forte, normale, faible ou morte.");
  }
  if (body.queen_present !== undefined && body.queen_present !== null && typeof body.queen_present !== "boolean") {
    return sendProblem(res, 400, "Le champ queen_present doit être un booléen.");
  }
  if (body.observations !== undefined && body.observations !== null && typeof body.observations !== "string") {
    return sendProblem(res, 400, "Le champ observations doit être un texte.");
  }

  // Synchronisation rejouée : même id déjà reçu pour cette ruche -> on renvoie l'existante.
  const existante = inspections.find((i) => i.id.toLowerCase() === body.id.toLowerCase());
  if (existante) {
    if (existante.hive_id !== hive.id) {
      return sendProblem(res, 409, `L'identifiant ${body.id} est déjà utilisé par une inspection d'une autre ruche.`);
    }
    return res.status(200).json(existante);
  }

  const maintenant = new Date().toISOString();
  const inspection = {
    id: body.id,
    hive_id: hive.id,
    inspected_at: body.inspected_at,
    colony_status: body.colony_status,
    queen_present: body.queen_present ?? null,
    observations: body.observations ?? null,
    version: 1,
    created_at: maintenant,
    updated_at: maintenant,
  };
  inspections.push(inspection);
  res.status(201).json(inspection);
});

export default router;
