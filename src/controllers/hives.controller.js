// Contrôleur : lit la requête, appelle un service, choisit la réponse.
// Pas de règle métier ici, et jamais d'import de repository.
// Les entrées ont déjà été vérifiées par validate : on lit req.validated, jamais req.body
// ni req.query. Les erreurs (async) remontent seules jusqu'à errorHandler (Express 5).
export function createHivesController({ hivesService, measuresService, inspectionsService }) {
  return {
    async list(req, res) {
      res.json(await hivesService.list({ site_id: req.validated.site_id }));
    },

    async getById(req, res) {
      res.json(await hivesService.get(req.params.id));
    },

    async addMeasure(req, res) {
      const measure = await measuresService.add(req.params.id, req.validated);
      res.status(201).json(measure);
    },

    async listMeasures(req, res) {
      res.json(await measuresService.list(req.params.id, req.validated));
    },

    async listInspections(req, res) {
      res.json(await inspectionsService.list(req.params.id));
    },

    async addInspection(req, res) {
      const { inspection, created } = await inspectionsService.add(req.params.id, req.validated);
      res.status(created ? 201 : 200).json(inspection);
    },
  };
}
