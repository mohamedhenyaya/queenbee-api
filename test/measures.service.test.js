import { test } from "node:test";
import assert from "node:assert/strict";
import { createMeasuresService } from "../src/services/measures.service.js";
import { NotFoundError, ValidationError } from "../src/errors.js";

// Les plages et les types sont testés sur les schémas (validators.test.js), les droits sur
// canAccessHive (hives.service.test.js). Ici, seulement ce qui a besoin de la ruche.

const admin = { id: "u-admin", role: "admin", site_id: null };
const validMeasure = { timestamp: "2026-10-31T10:00:00Z", weight_kg: 36.84 };

// Faux service des ruches : seules SN-CASA-001 et SN-CASA-002 existent.
const fakeHivesService = {
  async getHive(user, id) {
    if (!["SN-CASA-001", "SN-CASA-002"].includes(id)) {
      throw new NotFoundError(`Aucune ruche ne porte l'identifiant ${id}.`);
    }
    return { id, site_id: "SN-CASA", status: "active" };
  },
};

// Faux repository qui garde ce qu'on lui donne.
function createFakeMeasuresRepository() {
  const added = [];
  return {
    added,
    async insert(measure) {
      added.push(measure);
      return measure;
    },
  };
}

test("enregistre une mesure valide, rattachée à la ruche du chemin", async () => {
  const measuresRepository = createFakeMeasuresRepository();
  const service = createMeasuresService({ hivesService: fakeHivesService, measuresRepository });

  const mesure = await service.addMeasure(admin, "SN-CASA-001", validMeasure);

  assert.equal(measuresRepository.added.length, 1);
  assert.equal(mesure.hive_id, "SN-CASA-001");
  assert.equal(mesure.site_id, "SN-CASA");
  assert.equal(mesure.timestamp, "2026-10-31T10:00:00Z");
});

test("refuse une mesure pour une ruche inconnue", async () => {
  const measuresRepository = createFakeMeasuresRepository();
  const service = createMeasuresService({ hivesService: fakeHivesService, measuresRepository });

  await assert.rejects(service.addMeasure(admin, "XX-NOPE-999", validMeasure), NotFoundError);
  assert.equal(measuresRepository.added.length, 0);
});

test("refuse une trame qui désigne une autre ruche que le chemin", async () => {
  const measuresRepository = createFakeMeasuresRepository();
  const service = createMeasuresService({ hivesService: fakeHivesService, measuresRepository });

  await assert.rejects(
    service.addMeasure(admin, "SN-CASA-001", { ...validMeasure, hive_id: "SN-CASA-002" }),
    ValidationError,
  );
  assert.equal(measuresRepository.added.length, 0); // rien n'a été enregistré
});
