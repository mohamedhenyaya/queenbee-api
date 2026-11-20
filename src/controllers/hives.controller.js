// Contrôleur : lit la requête, appelle un service, choisit la réponse.
// Pas de règle métier ici, et jamais d'import de repository.
// L'utilisateur du jeton (req.user) est passé en premier à chaque service, qui vérifie ses droits.
// Les entrées ont déjà été vérifiées par validate : on lit req.validated, jamais req.body
// ni req.query. Les erreurs (async) remontent seules jusqu'à errorHandler (Express 5).
export function createHivesController({ hivesService, measuresService, inspectionsService }) {
  return {
    async list(req, res) {
      res.json(await hivesService.listHives(req.user, req.validated));
    },

    async getById(req, res) {
      res.json(await hivesService.getHive(req.user, req.params.id));
    },

    // 201 à la première réception, 200 si la trame est rejouée : le rejeu n'est pas une erreur.
    async addMeasure(req, res) {
      const { measure, created } = await measuresService.addMeasure(req.user, req.params.id, req.validated);
      res.status(created ? 201 : 200).json(measure);
    },

    async listMeasures(req, res) {
      res.json(await measuresService.listMeasures(req.user, req.params.id, req.validated));
    },

    async listInspections(req, res) {
      res.json(await inspectionsService.listInspections(req.user, req.params.id));
    },

    async addInspection(req, res) {
      const { inspection, created } = await inspectionsService.addInspection(req.user, req.params.id, req.validated);
      res.status(created ? 201 : 200).json(inspection);
    },
  };
}
