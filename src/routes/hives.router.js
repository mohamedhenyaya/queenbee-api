import { Router } from "express";
import { hives } from "../data/memory.js";

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

export default router;
