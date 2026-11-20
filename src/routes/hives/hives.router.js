import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import {
  hivesQuerySchema,
  paginationSchema,
  measureSchema,
  inspectionSchema,
} from "../../validators/schemas.js";

// Routeur : URL et verbe -> validation de l'entrée -> méthode du contrôleur. Aucune logique ici.
// Monté sur /api/hives dans app.js : les chemins sont relatifs.
export function createHivesRouter(controller) {
  const router = Router();

  router.get("/", validate(hivesQuerySchema, "query"), controller.list);
  router.get("/:id", controller.getById);
  router.post("/:id/measures", validate(measureSchema), controller.addMeasure);
  router.get("/:id/measures", validate(paginationSchema, "query"), controller.listMeasures);
  router.get("/:id/inspections", controller.listInspections);
  router.post("/:id/inspections", validate(inspectionSchema), controller.addInspection);

  return router;
}
