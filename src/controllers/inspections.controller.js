// Contrôleur de la synchronisation des inspections.
export function createInspectionsController({ inspectionsService }) {
  return {
    // Toujours 200 si le lot est bien formé : le détail de chaque inspection est dans la réponse.
    async sync(req, res) {
      res.json(await inspectionsService.syncInspections(req.user, req.validated.inspections));
    },
  };
}
