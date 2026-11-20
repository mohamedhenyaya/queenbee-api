import { ValidationError, ConflictError } from "../errors.js";

// Les champs, leurs types, l'UUID, la date et l'état de la colonie sont vérifiés par
// inspectionSchema (src/validators/schemas.js). Le service ne garde que les règles
// qui ont besoin de la ruche. Les droits passent par hivesService.getHive.
export function createInspectionsService({ hivesService, inspectionsRepository }) {
  return {
    async listInspections(user, hiveId) {
      const hive = await hivesService.getHive(user, hiveId);
      return inspectionsRepository.findByHive(hive.id);
    },

    // Enregistre une inspection dont l'id (UUID) est choisi par l'application mobile.
    // L'auteur est l'utilisateur connecté. Renvoie { inspection, created } : created vaut
    // false si la synchronisation est rejouée.
    async addInspection(user, hiveId, body) {
      const hive = await hivesService.getHive(user, hiveId);

      if (body.hive_id !== undefined && body.hive_id !== hive.id) {
        throw new ValidationError(`Le hive_id du corps (${body.hive_id}) ne correspond pas à la ruche ${hive.id}.`);
      }

      // Synchronisation rejouée : même id déjà reçu pour cette ruche -> on renvoie l'existante.
      const existante = await inspectionsRepository.findById(body.id);
      if (existante) {
        if (existante.hive_id !== hive.id) {
          throw new ConflictError(`L'identifiant ${body.id} est déjà utilisé par une inspection d'une autre ruche.`);
        }
        return { inspection: existante, created: false };
      }

      const inspection = await inspectionsRepository.insert({
        id: body.id,
        hive_id: hive.id,
        author_id: user.id,
        inspected_at: body.inspected_at,
        colony_status: body.colony_status,
        queen_present: body.queen_present ?? null,
        observations: body.observations ?? null,
      });
      return { inspection, created: true };
    },
  };
}
