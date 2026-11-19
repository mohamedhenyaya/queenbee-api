import { ValidationError } from "../errors.js";
import { isIsoDate, parseIntParam } from "./validation.js";

// Plages physiques retenues pour le module (UC-CY02, champs du § 6.5).
export const PHYSICAL_RANGES = {
  position_lat: [-90, 90],
  position_lon: [-180, 180],
  weight_kg: [0, 150],
  temp_internal_c: [-10, 60],
  temp_external_c: [-20, 60],
  humidity_pct: [0, 100],
  acoustic_activity_score: [0, 1],
  battery_pct: [0, 100],
};

export function createMeasuresService({ hivesService, measuresRepository }) {
  return {
    // Enregistre une trame de la passerelle. Lève NotFoundError ou ValidationError.
    async add(hiveId, body = {}) {
      const hive = await hivesService.get(hiveId);

      if (body.timestamp === undefined || body.weight_kg === undefined) {
        throw new ValidationError("Les champs timestamp et weight_kg sont obligatoires.");
      }
      if (!isIsoDate(body.timestamp)) {
        throw new ValidationError("Le champ timestamp doit être une date ISO 8601, par exemple 2026-10-31T10:00:00Z.");
      }
      for (const [champ, [min, max]] of Object.entries(PHYSICAL_RANGES)) {
        const valeur = body[champ];
        if (valeur === undefined) continue;
        if (!Number.isFinite(valeur)) {
          throw new ValidationError(`Le champ ${champ} doit être un nombre.`);
        }
        if (valeur < min || valeur > max) {
          throw new ValidationError(`Le champ ${champ} doit être compris entre ${min} et ${max} (reçu : ${valeur}).`);
        }
      }
      if (body.hive_id !== undefined && body.hive_id !== hive.id) {
        throw new ValidationError(`Le hive_id du corps (${body.hive_id}) ne correspond pas à la ruche ${hive.id}.`);
      }

      // On garde le timestamp de la trame : l'instant de la mesure, pas celui de la réception.
      return measuresRepository.insert({ ...body, hive_id: hive.id, site_id: hive.site_id });
    },

    // Historique paginé, de la plus récente à la plus ancienne.
    async list(hiveId, query = {}) {
      const hive = await hivesService.get(hiveId);

      const limit = parseIntParam(query.limit, "limit", { defaut: 50, min: 1, max: 500 });
      if (limit.erreur) throw new ValidationError(limit.erreur);
      const offset = parseIntParam(query.offset, "offset", { defaut: 0, min: 0, max: Infinity });
      if (offset.erreur) throw new ValidationError(offset.erreur);

      const items = await measuresRepository.findByHive(hive.id, { limit: limit.valeur, offset: offset.valeur });
      return { items, limit: limit.valeur, offset: offset.valeur };
    },
  };
}
