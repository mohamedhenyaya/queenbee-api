import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/middlewares/validate.js";
import {
  hivesQuerySchema,
  paginationSchema,
  measureSchema,
  inspectionSchema,
} from "../src/validators/schemas.js";
import { ValidationError } from "../src/errors.js";

// Passe des données dans validate, sans serveur : renvoie req.validated, ou lève l'erreur.
function run(schema, data, source = "body") {
  const req = { [source]: data };
  validate(schema, source)(req, {}, () => {});
  return req.validated;
}

// Renvoie le message de la ValidationError levée par validate.
function messageOf(schema, data, source) {
  try {
    run(schema, data, source);
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.message;
  }
  assert.fail("une ValidationError était attendue");
}

const UUID = "3f2c9a1e-5b7d-4c8e-9f10-2a3b4c5d6e7f";

// --- Mesures

test("refuse un poids hors de sa plage physique", () => {
  assert.throws(() => run(measureSchema, { timestamp: "2026-10-31T00:00:00Z", weight_kg: 500 }), ValidationError);
});

test("refuse un poids qui n'est pas un nombre", () => {
  assert.throws(() => run(measureSchema, { timestamp: "2026-10-31T00:00:00Z", weight_kg: "abc" }), ValidationError);
});

test("signale toutes les erreurs d'une mesure, en français", () => {
  assert.equal(
    messageOf(measureSchema, { timestamp: "2026-11-06T08:00:00Z", weight_kg: 500, humidity_pct: 120 }),
    "weight_kg doit être inférieur ou égal à 150. humidity_pct doit être inférieur ou égal à 100.",
  );
});

test("une mesure sans corps signale les deux champs obligatoires", () => {
  assert.equal(messageOf(measureSchema, undefined), "timestamp est obligatoire. weight_kg est obligatoire.");
});

test("accepte une mesure valide, avec des champs facultatifs à null", () => {
  const mesure = run(measureSchema, { timestamp: "2026-10-31T00:00:00Z", weight_kg: 36.8, battery_pct: null });
  assert.equal(mesure.weight_kg, 36.8);
  assert.equal(mesure.battery_pct, null);
});

// --- Pagination

test("applique les valeurs par défaut de la pagination", () => {
  assert.deepEqual(run(paginationSchema, {}, "query"), { limit: 50, offset: 0 });
});

test("convertit les paramètres de requête en nombres", () => {
  assert.deepEqual(run(paginationSchema, { limit: "10", offset: "20" }, "query"), { limit: 10, offset: 20 });
});

test("refuse ?limit=abc", () => {
  assert.equal(messageOf(paginationSchema, { limit: "abc" }, "query"), "limit doit être un nombre.");
});

test("refuse une limite hors bornes ou non entière", () => {
  for (const limit of ["0", "501", "1.5", ""]) {
    assert.throws(() => run(paginationSchema, { limit }, "query"), ValidationError, `limit=${limit}`);
  }
});

// --- Ruches

test("refuse un paramètre de recherche inconnu sur les ruches", () => {
  assert.throws(() => run(hivesQuerySchema, { status: "active" }, "query"), ValidationError);
});

// --- Inspections

test("accepte une inspection valide", () => {
  const inspection = run(inspectionSchema, { id: UUID, inspected_at: "2026-11-01T09:00:00Z", colony_status: "forte" });
  assert.equal(inspection.id, UUID);
});

test("refuse un author_id glissé dans une inspection", () => {
  assert.equal(
    messageOf(inspectionSchema, { id: UUID, inspected_at: "2026-11-01T09:00:00Z", colony_status: "forte", author_id: "x" }),
    "author_id n'est pas un champ autorisé.",
  );
});

test("refuse une inspection datée dans le futur", () => {
  assert.equal(
    messageOf(inspectionSchema, { id: UUID, inspected_at: "2099-01-01T00:00:00Z", colony_status: "forte" }),
    "inspected_at ne peut pas être dans le futur.",
  );
});

test("refuse un id qui n'est pas un UUID et un état de colonie inconnu", () => {
  const message = messageOf(inspectionSchema, { id: "123", inspected_at: "2026-11-01T09:00:00Z", colony_status: "super" });
  assert.match(message, /id doit être un UUID\./);
  assert.match(message, /colony_status doit valoir l'une de ces valeurs/);
});

test("refuse des observations de plus de 2 000 caractères", () => {
  assert.throws(
    () => run(inspectionSchema, { id: UUID, inspected_at: "2026-11-01T09:00:00Z", colony_status: "forte", observations: "a".repeat(2001) }),
    ValidationError,
  );
});
