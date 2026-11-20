import { Router } from "express";
import { requireRole } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  hivesQuerySchema,
  paginationSchema,
  measureSchema,
  inspectionSchema,
} from "../../validators/schemas.js";

// Routeur : URL et verbe -> jeton -> rôle -> validation de l'entrée -> méthode du contrôleur.
// Monté sur /api/hives dans app.js : les chemins sont relatifs. Les droits sur une ruche
// précise (site, propriétaire) sont vérifiés dans les services.
export function createHivesRouter({ controller, requireAuth }) {
  const router = Router();

  router.use(requireAuth); // toutes les routes des ruches demandent un jeton

  router.get("/", validate(hivesQuerySchema, "query"), controller.list);
  router.get("/:id", controller.getById);
  // L'admin simule la passerelle : lui seul envoie des mesures.
  router.post("/:id/measures", requireRole("admin"), validate(measureSchema), controller.addMeasure);
  router.get("/:id/measures", validate(paginationSchema, "query"), controller.listMeasures);
  router.get("/:id/inspections", controller.listInspections);
  router.post(
    "/:id/inspections",
    requireRole("apiculteur", "coordinateur"),
    validate(inspectionSchema),
    controller.addInspection,
  );

  return router;
}
