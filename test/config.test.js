import { test } from "node:test";
import assert from "node:assert/strict";

// config.js lit process.env à l'import : on lui donne d'abord un environnement valide,
// puis on teste loadConfig avec des environnements construits à la main.
const valide = {
  DB_PASSWORD: "x",
  JWT_ACCESS_SECRET: "secret-acces",
  JWT_REFRESH_SECRET: "secret-renouvellement",
};
Object.assign(process.env, valide);
const { loadConfig } = await import("../src/config.js");

test("config : durées des jetons et règle de blocage par défaut", () => {
  const { auth } = loadConfig(valide);
  assert.equal(auth.accessTtl, "15m");
  assert.equal(auth.refreshTtl, "7d");
  assert.equal(auth.maxFailedLogins, 5);
  assert.equal(auth.lockMinutes, 15);
});

test("config : refuse un secret JWT manquant", () => {
  assert.throws(() => loadConfig({ ...valide, JWT_ACCESS_SECRET: "" }), /JWT_ACCESS_SECRET est obligatoire/);
  assert.throws(() => loadConfig({ ...valide, JWT_REFRESH_SECRET: undefined }), /JWT_REFRESH_SECRET est obligatoire/);
});

test("config : refuse deux secrets identiques", () => {
  assert.throws(() => loadConfig({ ...valide, JWT_REFRESH_SECRET: valide.JWT_ACCESS_SECRET }), /doivent être différents/);
});

test("config : refuse un mot de passe de base vide", () => {
  assert.throws(() => loadConfig({ ...valide, DB_PASSWORD: "" }), /DB_PASSWORD est obligatoire/);
});
