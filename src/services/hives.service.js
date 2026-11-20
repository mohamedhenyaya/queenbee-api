import { NotFoundError, ForbiddenError } from "../errors.js";

// La règle d'accès aux ruches, écrite une seule fois. Les services des mesures et des
// inspections passent par getHive, donc par elle.
export function canAccessHive(user, hive) {
  switch (user.role) {
    case "admin":
    case "gestionnaire":
      return true;
    case "coordinateur":
      return hive.site_id === user.site_id;
    case "apiculteur":
      return hive.owner_id === user.id;
    default:
      return false;
  }
}

export function createHivesService({ hivesRepository }) {
  return {
    // Ce que chaque rôle voit : un coordinateur reçoit toujours son site (403 s'il en demande
    // un autre), un apiculteur ses ruches, admin et gestionnaire toutes.
    async listHives(user, { site_id } = {}) {
      const filtreSite = site_id || null; // ?site_id= (chaîne vide) : pas de filtre
      if (user.role === "coordinateur") {
        if (filtreSite && filtreSite !== user.site_id) {
          throw new ForbiddenError(`Vous n'avez pas accès au site ${filtreSite}.`);
        }
        return hivesRepository.findAll({ site_id: user.site_id });
      }
      if (user.role === "apiculteur") {
        return hivesRepository.findAll({ site_id: filtreSite, owner_id: user.id });
      }
      if (user.role === "admin" || user.role === "gestionnaire") {
        return hivesRepository.findAll({ site_id: filtreSite });
      }
      throw new ForbiddenError("Votre rôle ne donne accès à aucune ruche.");
    },

    // L'existence d'abord (404), les droits ensuite (403).
    async getHive(user, id) {
      const hive = await hivesRepository.findById(id);
      if (!hive) {
        throw new NotFoundError(`Aucune ruche ne porte l'identifiant ${id}.`);
      }
      if (!canAccessHive(user, hive)) {
        throw new ForbiddenError(`Vous n'avez pas accès à la ruche ${id}.`);
      }
      return hive;
    },
  };
}
