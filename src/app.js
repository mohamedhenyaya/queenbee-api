import express from "express";
import { config } from "./config.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { createRequireAuth } from "./middlewares/auth.js";
import { createAuthService } from "./services/auth.service.js";
import { createHivesService } from "./services/hives.service.js";
import { createMeasuresService } from "./services/measures.service.js";
import { createInspectionsService } from "./services/inspections.service.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createHivesController } from "./controllers/hives.controller.js";
import { createAuthRouter } from "./routes/auth/auth.router.js";
import { createHivesRouter } from "./routes/hives/hives.router.js";

// Crée l'application à partir des repositories qu'on lui passe : c'est ici, et seulement ici,
// que les couches sont branchées.
export function createApp({ hivesRepository, measuresRepository, inspectionsRepository, usersRepository }) {
  const authService = createAuthService({ usersRepository, auth: config.auth });
  const requireAuth = createRequireAuth(authService);
  const hivesService = createHivesService({ hivesRepository });
  const measuresService = createMeasuresService({ hivesService, measuresRepository });
  const inspectionsService = createInspectionsService({ hivesService, inspectionsRepository });

  const app = express();

  // Journal en premier, pour voir toutes les requêtes, y compris celles en erreur.
  app.use(requestLogger);
  // Lit le corps JSON des requêtes : doit être déclaré avant les routes.
  // Au-delà de 1 Mo, la requête est refusée (413) avant d'atteindre une route.
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter({ controller: createAuthController({ authService }), requireAuth }));
  app.use("/api/hives", createHivesRouter({
    controller: createHivesController({ hivesService, measuresService, inspectionsService }),
    requireAuth, // le routeur des ruches fait router.use(requireAuth) en tête
  }));

  // Après toutes les routes : route inconnue, puis filet de sécurité.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
