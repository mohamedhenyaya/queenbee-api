import { test } from "node:test";
import assert from "node:assert/strict";
import { createMeasuresService } from "../src/services/measures.service.js";
import { ValidationError } from "../src/errors.js";

test("refuse un poids hors de sa plage physique", async () => {
  // Préparer : un faux repository qui garde ce qu'on lui donne, injecté dans le service
  const enregistrees = [];
  const measuresRepository = {
    async insert(measure) {
      enregistrees.push(measure);
      return measure;
    },
  };
  const hivesService = {
    async get(id) {
      return { id, site_id: "SN-CASA", status: "active" };
    },
  };
  const service = createMeasuresService({ hivesService, measuresRepository });

  // Agir : ajouter une mesure de 500 kg
  const ajout = service.add("SN-CASA-001", { timestamp: "2026-10-31T10:00:00Z", weight_kg: 500 });

  // Vérifier : une ValidationError est levée (assert.rejects), et rien n'est enregistré
  await assert.rejects(ajout, ValidationError);
  assert.equal(enregistrees.length, 0);
});

test("accepte un poids dans sa plage physique", async () => {
  const enregistrees = [];
  const service = createMeasuresService({
    hivesService: { get: async (id) => ({ id, site_id: "SN-CASA", status: "active" }) },
    measuresRepository: { insert: async (m) => (enregistrees.push(m), m) },
  });

  const mesure = await service.add("SN-CASA-001", { timestamp: "2026-10-31T10:00:00Z", weight_kg: 36.84 });

  assert.equal(enregistrees.length, 1);
  assert.equal(mesure.hive_id, "SN-CASA-001");
  assert.equal(mesure.timestamp, "2026-10-31T10:00:00Z");
});
