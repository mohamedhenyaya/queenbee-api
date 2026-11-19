import express from "express";
import { requestLogger } from "./middlewares/requestLogger.js";
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

export default app;
