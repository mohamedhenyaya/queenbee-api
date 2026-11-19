import { Router } from "express";
import { hives, measures } from "../data/memory.js";

// Routeur monté sur /api/hives dans app.js : les chemins ici sont relatifs ("/", "/:id").
const router = Router();

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
  const hive = hives.find((h) => h.id === req.params.id);
  if (!hive) {
    return res.status(404).json({ error: `Aucune ruche ne porte l'identifiant ${req.params.id}.` });
  }
  res.json(hive);
});

// POST /api/hives/:id/measures : enregistre une trame envoyée par la passerelle (§ 6.5).
router.post("/:id/measures", (req, res) => {
  const hive = hives.find((h) => h.id === req.params.id);
  if (!hive) {
    return res.status(404).json({ error: `Aucune ruche ne porte l'identifiant ${req.params.id}.` });
  }

  const body = req.body ?? {};
  if (body.timestamp === undefined || body.weight_kg === undefined) {
    return res.status(400).json({ error: "Les champs timestamp et weight_kg sont obligatoires." });
  }
  if (body.hive_id !== undefined && body.hive_id !== hive.id) {
    return res
      .status(400)
      .json({ error: `Le hive_id du corps (${body.hive_id}) ne correspond pas à la ruche ${hive.id}.` });
  }

  // On garde le timestamp de la trame : l'instant de la mesure, pas celui de la réception.
  const measure = { ...body, hive_id: hive.id, site_id: hive.site_id };
  measures.push(measure);
  res.status(201).json(measure);
});

export default router;
