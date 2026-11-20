import { test } from "node:test";
import assert from "node:assert/strict";
import { createInspectionsService } from "../src/services/inspections.service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../src/errors.js";

const beekeeper = { id: "u-api1", role: "apiculteur", site_id: "SN-CASA" };
const hives = {
  "SN-CASA-001": { id: "SN-CASA-001", site_id: "SN-CASA", owner_id: "u-api1" },
  "SN-CASA-002": { id: "SN-CASA-002", site_id: "SN-CASA", owner_id: "u-api1" },
  "SN-CASA-011": { id: "SN-CASA-011", site_id: "SN-CASA", owner_id: "u-api2" },
};
const fakeHivesService = {
  async getHive(user, id) {
    const hive = hives[id];
    if (!hive) throw new NotFoundError(`Aucune ruche ne porte l'identifiant ${id}.`);
    if (hive.owner_id !== user.id) throw new ForbiddenError(`Vous n'avez pas accès à la ruche ${id}.`);
    return hive;
  },
};

// Imite le SQL : INSERT … ON CONFLICT (id) DO NOTHING, et UPDATE … WHERE version = …
function createFakeInspectionsRepository() {
  const rows = new Map();
  return {
    rows,
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async insertIfAbsent(inspection) {
      if (rows.has(inspection.id)) return { inspection: rows.get(inspection.id), created: false };
      const stored = { ...inspection, version: 1 };
      rows.set(inspection.id, stored);
      return { inspection: stored, created: true };
    },
    async updateIfVersion(inspection, expectedVersion) {
      const current = rows.get(inspection.id);
      if (!current || current.hive_id !== inspection.hive_id || current.version !== expectedVersion) return null;
      const updated = { ...current, ...inspection, author_id: current.author_id, version: current.version + 1 };
      rows.set(inspection.id, updated);
      return updated;
    },
  };
}

function setup() {
  const inspectionsRepository = createFakeInspectionsRepository();
  const service = createInspectionsService({ hivesService: fakeHivesService, inspectionsRepository });
  return { inspectionsRepository, service };
}

const inspection = { id: "0b6c4a0e-6f1f-4d8e-9a39-2f3c9b1d7e55", inspected_at: "2026-11-01T09:30:00Z", colony_status: "forte" };

test("envoyer deux fois la même inspection ne crée pas de doublon", async () => {
  const { inspectionsRepository, service } = setup();

  const first = await service.addInspection(beekeeper, "SN-CASA-001", inspection);
  const second = await service.addInspection(beekeeper, "SN-CASA-001", inspection);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(inspectionsRepository.rows.size, 1);
});

test("l'auteur est l'utilisateur connecté", async () => {
  const { service } = setup();
  const { inspection: stored } = await service.addInspection(beekeeper, "SN-CASA-001", inspection);
  assert.equal(stored.author_id, "u-api1");
});

test("le même id sur une autre ruche donne 409", async () => {
  const { service } = setup();
  await service.addInspection(beekeeper, "SN-CASA-001", inspection);
  await assert.rejects(service.addInspection(beekeeper, "SN-CASA-002", inspection), ConflictError);
});

test("une version périmée donne un conflit, et le serveur garde sa donnée", async () => {
  const { inspectionsRepository, service } = setup();
  await service.addInspection(beekeeper, "SN-CASA-001", inspection);
  // Un autre appareil a modifié l'inspection : elle passe en version 2.
  await inspectionsRepository.updateIfVersion({ ...inspection, hive_id: "SN-CASA-001", colony_status: "faible" }, 1);

  const { results } = await service.syncInspections(beekeeper, [
    { ...inspection, hive_id: "SN-CASA-001", colony_status: "morte", version: 1 },
  ]);

  assert.equal(results[0].status, "conflict");
  assert.equal(results[0].current.version, 2);
  assert.equal(results[0].current.colony_status, "faible");
  assert.equal(inspectionsRepository.rows.get(inspection.id).colony_status, "faible");
});

test("synchronisation : created, puis unchanged au rejeu ; une ruche interdite n'empêche pas les autres", async () => {
  const { inspectionsRepository, service } = setup();
  const lot = [
    { ...inspection, hive_id: "SN-CASA-001" },
    { id: "a1b2c3d4-0000-4000-8000-000000000002", hive_id: "SN-CASA-002", inspected_at: "2026-11-02T08:00:00Z", colony_status: "normale" },
    { id: "a1b2c3d4-0000-4000-8000-000000000011", hive_id: "SN-CASA-011", inspected_at: "2026-11-02T08:00:00Z", colony_status: "normale" },
    { id: "a1b2c3d4-0000-4000-8000-000000000099", hive_id: "XX-NOPE-999", inspected_at: "2026-11-02T08:00:00Z", colony_status: "normale" },
  ];

  const first = await service.syncInspections(beekeeper, lot);
  assert.deepEqual(first.summary, { created: 2, unchanged: 0, updated: 0, conflict: 0, rejected: 2 });
  assert.deepEqual(first.results[2], { id: lot[2].id, status: "rejected", detail: "Vous n'avez pas accès à la ruche SN-CASA-011." });
  assert.equal(first.results[3].detail, "Aucune ruche ne porte l'identifiant XX-NOPE-999.");

  const second = await service.syncInspections(beekeeper, lot);
  assert.deepEqual(second.summary, { created: 0, unchanged: 2, updated: 0, conflict: 0, rejected: 2 });
  assert.equal(inspectionsRepository.rows.size, 2); // aucun doublon
});

test("synchronisation : une version à jour donne updated et la version suivante, rejouée elle donne conflict", async () => {
  const { service } = setup();
  await service.syncInspections(beekeeper, [{ ...inspection, hive_id: "SN-CASA-001" }]);
  const modification = [{ ...inspection, hive_id: "SN-CASA-001", colony_status: "normale", version: 1 }];

  const first = await service.syncInspections(beekeeper, modification);
  assert.deepEqual(first.results[0], { id: inspection.id, status: "updated", version: 2 });

  const second = await service.syncInspections(beekeeper, modification);
  assert.equal(second.results[0].status, "conflict");
  assert.equal(second.results[0].current.version, 2);
  assert.equal(second.results[0].detail, "L'inspection a été modifiée entre-temps : version 2 sur le serveur, 1 sur l'appareil.");
});

test("synchronisation : un id pris par une autre ruche, ou une version sur une inspection inconnue, est rejeté", async () => {
  const { service } = setup();
  await service.addInspection(beekeeper, "SN-CASA-001", inspection);

  const { summary, results } = await service.syncInspections(beekeeper, [
    { ...inspection, hive_id: "SN-CASA-002" },
    { id: "a1b2c3d4-0000-4000-8000-0000000000aa", hive_id: "SN-CASA-001", inspected_at: "2026-11-02T08:00:00Z", colony_status: "forte", version: 1 },
  ]);

  assert.equal(summary.rejected, 2);
  assert.equal(results[0].detail, "Cet identifiant est déjà utilisé par une inspection d'une autre ruche.");
  assert.match(results[1].detail, /^Inspection inconnue pour cette ruche/);
});

test("synchronisation : une erreur qui n'est pas une AppError remonte (c'est un bug)", async () => {
  const inspectionsRepository = createFakeInspectionsRepository();
  inspectionsRepository.insertIfAbsent = async () => { throw new TypeError("panne"); };
  const service = createInspectionsService({ hivesService: fakeHivesService, inspectionsRepository });

  await assert.rejects(service.syncInspections(beekeeper, [{ ...inspection, hive_id: "SN-CASA-001" }]), TypeError);
});
