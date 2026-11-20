import express from "express";
import { requireRole } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { loginSchema, refreshSchema, registerSchema } from "../../validators/schemas.js";

// Monté sur /api/auth dans app.js.
export function createAuthRouter({ controller, requireAuth }) {
  const router = express.Router();
  router.post("/login", validate(loginSchema), controller.login);       // public
  router.post("/refresh", validate(refreshSchema), controller.refresh); // public
  // Création de compte réservée à l'administrateur (UC-AD01) : requireAuth avant requireRole.
  router.post("/register", requireAuth, requireRole("admin"), validate(registerSchema), controller.register);
  router.get("/me", requireAuth, controller.me);
  return router;
}
