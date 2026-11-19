import { Router } from "express";

// Routeur : URL et verbe -> méthode du contrôleur. Aucune logique ici.
// Monté sur /api/hives dans app.js : les chemins sont relatifs.
export function createHivesRouter(controller) {
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post("/:id/measures", controller.addMeasure);
  router.get("/:id/measures", controller.listMeasures);
  router.get("/:id/inspections", controller.listInspections);
  router.post("/:id/inspections", controller.addInspection);

  return router;
}
