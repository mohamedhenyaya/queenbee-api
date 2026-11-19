import { NotFoundError } from "../errors.js";

export function createHivesService({ hivesRepository }) {
  return {
    async list({ site_id } = {}) {
      // ?site_id= (chaîne vide) est traité comme l'absence de filtre.
      return hivesRepository.findAll({ site_id: site_id || undefined });
    },

    // Renvoie la ruche, ou lève NotFoundError : les autres services s'en servent
    // pour vérifier qu'une ruche existe avant d'y rattacher des données.
    async get(id) {
      const hive = await hivesRepository.findById(id);
      if (!hive) throw new NotFoundError(`Aucune ruche ne porte l'identifiant ${id}.`);
      return hive;
    },
  };
}
