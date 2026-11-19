import { ValidationError, ConflictError } from "../errors.js";
import { isIsoDate, UUID } from "./validation.js";

const COLONY_STATUSES = ["forte", "normale", "faible", "morte"];

export function createInspectionsService({ hivesService, inspectionsRepository }) {
  return {
    async list(hiveId) {
      const hive = await hivesService.get(hiveId);
      return inspectionsRepository.findByHive(hive.id);
    },

    // Enregistre une inspection dont l'id (UUID) est choisi par l'application mobile.
    // Renvoie { inspection, created } : created vaut false si la synchronisation est rejouée.
    async add(hiveId, body = {}) {
      const hive = await hivesService.get(hiveId);

      for (const champ of ["id", "inspected_at", "colony_status"]) {
        if (body[champ] === undefined) throw new ValidationError(`Le champ ${champ} est obligatoire.`);
      }
      if (typeof body.id !== "string" || !UUID.test(body.id)) {
        throw new ValidationError("Le champ id doit être un UUID.");
      }
      if (!isIsoDate(body.inspected_at)) {
        throw new ValidationError("Le champ inspected_at doit être une date ISO 8601, par exemple 2026-10-31T09:30:00Z.");
      }
      if (!COLONY_STATUSES.includes(body.colony_status)) {
        throw new ValidationError("Le champ colony_status doit valoir forte, normale, faible ou morte.");
      }
      if (body.queen_present != null && typeof body.queen_present !== "boolean") {
        throw new ValidationError("Le champ queen_present doit être un booléen.");
      }
      if (body.observations != null && typeof body.observations !== "string") {
        throw new ValidationError("Le champ observations doit être un texte.");
      }

      // Synchronisation rejouée : même id déjà reçu pour cette ruche -> on renvoie l'existante.
      const existante = await inspectionsRepository.findById(body.id);
      if (existante) {
        if (existante.hive_id !== hive.id) {
          throw new ConflictError(`L'identifiant ${body.id} est déjà utilisé par une inspection d'une autre ruche.`);
        }
        return { inspection: existante, created: false };
      }

      const maintenant = new Date().toISOString();
      const inspection = await inspectionsRepository.insert({
        id: body.id,
        hive_id: hive.id,
        inspected_at: body.inspected_at,
        colony_status: body.colony_status,
        queen_present: body.queen_present ?? null,
        observations: body.observations ?? null,
        version: 1,
        created_at: maintenant,
        updated_at: maintenant,
      });
      return { inspection, created: true };
    },
  };
}
