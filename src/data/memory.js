import { readFileSync } from "node:fs";
import { join } from "node:path";

// Données en mémoire, copiées du jeu de données (db/migrations/002_seed.sql).
// Elles disparaissent à chaque redémarrage du serveur.
export const hives = [
  { id: "SN-CASA-001", site_id: "SN-CASA", status: "active" },
  { id: "SN-CASA-002", site_id: "SN-CASA", status: "active" },
  { id: "SN-CASA-014", site_id: "SN-CASA", status: "active" },
  { id: "CI-AGBO-001", site_id: "CI-AGBO", status: "active" },
  { id: "CI-AGBO-049", site_id: "CI-AGBO", status: "inactive" },
];

// Mesures de départ : la journée du 31 octobre des ruches SN-CASA ci-dessus
// (96 mesures par ruche), lues dans le fichier fourni par le kit.
const FICHIER = join(import.meta.dirname, "..", "..", "data", "mesures-SN-CASA-2026-10-31.ndjson");
const ids = new Set(hives.map((h) => h.id));

export const measures = readFileSync(FICHIER, "utf8")
  .split("\n")
  .filter((ligne) => ligne.trim() !== "")
  .map((ligne) => JSON.parse(ligne))
  .filter((m) => ids.has(m.hive_id));

export const inspections = [];
