import express from "express";

const app = express();

// Lit le corps JSON des requêtes : doit être déclaré avant les routes.
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
