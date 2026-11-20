import { ValidationError } from "../errors.js";

// Les champs obligatoires, les types et les plages physiques sont vérifiés par measureSchema
// et paginationSchema (src/validators/schemas.js) avant d'arriver ici. Le service ne garde
// que les règles qui ont besoin de la ruche. Les droits passent par hivesService.getHive.
export function createMeasuresService({ hivesService, measuresRepository }) {
  return {
    // Enregistre une trame de la passerelle. Lève NotFoundError, ForbiddenError ou ValidationError.
    async addMeasure(user, hiveId, measure) {
      const hive = await hivesService.getHive(user, hiveId);

      if (measure.hive_id !== undefined && measure.hive_id !== hive.id) {
        throw new ValidationError(`Le hive_id du corps (${measure.hive_id}) ne correspond pas à la ruche ${hive.id}.`);
      }

      // On garde le timestamp de la trame : l'instant de la mesure, pas celui de la réception.
      return measuresRepository.insert({ ...measure, hive_id: hive.id, site_id: hive.site_id });
    },

    // Historique paginé, de la plus récente à la plus ancienne.
    async listMeasures(user, hiveId, { limit, offset }) {
      const hive = await hivesService.getHive(user, hiveId);
      const items = await measuresRepository.findByHive(hive.id, { limit, offset });
      return { items, limit, offset };
    },
  };
}
