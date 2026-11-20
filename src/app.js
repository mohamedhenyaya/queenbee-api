import express from "express";
import { requestLogger } from "./middlewares/requestLogger.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { createHivesService } from "./services/hives.service.js";
import { createMeasuresService } from "./services/measures.service.js";
import { createInspectionsService } from "./services/inspections.service.js";
import { createHivesController } from "./controllers/hives.controller.js";
import { createHivesRouter } from "./routes/hives/hives.router.js";

// Crée l'application à partir des repositories qu'on lui passe (en mémoire aujourd'hui,
// PostgreSQL demain) : c'est ici, et seulement ici, que les couches sont branchées.
export function createApp({ hivesRepository, measuresRepository, inspectionsRepository }) {
  const hivesService = createHivesService({ hivesRepository });
  const measuresService = createMeasuresService({ hivesService, measuresRepository });
  const inspectionsService = createInspectionsService({ hivesService, inspectionsRepository });
  const hivesController = createHivesController({ hivesService, measuresService, inspectionsService });

  const app = express();

  // Journal en premier, pour voir toutes les requêtes, y compris celles en erreur.
  app.use(requestLogger);
  // Lit le corps JSON des requêtes : doit être déclaré avant les routes.
  // Au-delà de 1 Mo, la requête est refusée (413) avant d'atteindre une route.
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/hives", createHivesRouter(hivesController));

  // Après toutes les routes : route inconnue, puis filet de sécurité.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
