import { readFileSync } from "node:fs";
import { join } from "node:path";

// Données de départ en mémoire, copiées du jeu de données (db/migrations/002_seed.sql).
export const seedHives = [
  { id: "SN-CASA-001", site_id: "SN-CASA", status: "active" },
  { id: "SN-CASA-002", site_id: "SN-CASA", status: "active" },
  { id: "SN-CASA-014", site_id: "SN-CASA", status: "active" },
  { id: "CI-AGBO-001", site_id: "CI-AGBO", status: "active" },
  { id: "CI-AGBO-049", site_id: "CI-AGBO", status: "inactive" },
];

const FICHIER = join(import.meta.dirname, "..", "..", "..", "data", "mesures-SN-CASA-2026-10-31.ndjson");

// Mesures de départ : la journée du 31 octobre des ruches ci-dessus (96 par ruche SN-CASA).
export function loadSeedMeasures(hives = seedHives) {
  const ids = new Set(hives.map((h) => h.id));
  return readFileSync(FICHIER, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() !== "")
    .map((ligne) => JSON.parse(ligne))
    .filter((m) => ids.has(m.hive_id));
}
