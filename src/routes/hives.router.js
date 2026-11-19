import { Router } from "express";
import { hives, measures } from "../data/memory.js";
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

export default router;
