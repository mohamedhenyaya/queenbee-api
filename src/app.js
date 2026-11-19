import express from "express";
import { requestLogger } from "./middlewares/requestLogger.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import hivesRouter from "./routes/hives.router.js";

const app = express();

// Journal en premier, pour voir toutes les requêtes, y compris celles en erreur.
app.use(requestLogger);
// Lit le corps JSON des requêtes : doit être déclaré avant les routes.
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/hives", hivesRouter);

// Après toutes les routes : route inconnue, puis filet de sécurité.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
