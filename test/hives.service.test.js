import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessHive, createHivesService } from "../src/services/hives.service.js";
import { ForbiddenError, NotFoundError } from "../src/errors.js";

const ruche = { id: "SN-CASA-001", site_id: "SN-CASA", owner_id: "u-api1" };

const admin = { id: "u-admin", role: "admin", site_id: null };
const gestion = { id: "u-gestion", role: "gestionnaire", site_id: null };
const coord = { id: "u-coord", role: "coordinateur", site_id: "SN-CASA" };
const api1 = { id: "u-api1", role: "apiculteur", site_id: "SN-CASA" };

test("canAccessHive : chaque rôle voit ce qu'il doit voir", () => {
  assert.equal(canAccessHive(admin, ruche), true);
  assert.equal(canAccessHive(gestion, ruche), true);
  assert.equal(canAccessHive(coord, ruche), true);
  assert.equal(canAccessHive({ id: "u-coord2", role: "coordinateur", site_id: "CI-AGBO" }, ruche), false);
  assert.equal(canAccessHive(api1, ruche), true);
  assert.equal(canAccessHive({ id: "u-api2", role: "apiculteur", site_id: "SN-CASA" }, ruche), false);
});

test("canAccessHive : un rôle inconnu ne voit rien", () => {
  assert.equal(canAccessHive({ id: "u-x", role: "visiteur", site_id: "SN-CASA" }, ruche), false);
});

// Faux repository : garde les filtres reçus, et ne connaît que la ruche ci-dessus.
function createFakeHivesRepository() {
  const filtres = [];
  return {
    filtres,
    async findAll(filtre) {
      filtres.push(filtre);
      return [];
    },
    async findById(id) {
      return id === ruche.id ? ruche : null;
    },
  };
}

test("listHives : chaque rôle reçoit le bon filtre", async () => {
  const hivesRepository = createFakeHivesRepository();
  const service = createHivesService({ hivesRepository });

  await service.listHives(admin, {});
  await service.listHives(gestion, { site_id: "CI-AGBO" });
  await service.listHives(coord, {});
  await service.listHives(coord, { site_id: "SN-CASA" });
  await service.listHives(api1, { site_id: "" });

  assert.deepEqual(hivesRepository.filtres, [
    { site_id: null },
    { site_id: "CI-AGBO" },
    { site_id: "SN-CASA" },                  // le coordinateur reçoit toujours son site
    { site_id: "SN-CASA" },
    { site_id: null, owner_id: "u-api1" },   // l'apiculteur, ses ruches
  ]);
});

test("listHives : un coordinateur qui demande un autre site reçoit 403", async () => {
  const hivesRepository = createFakeHivesRepository();
  const service = createHivesService({ hivesRepository });

  await assert.rejects(service.listHives(coord, { site_id: "CI-AGBO" }), ForbiddenError);
  assert.equal(hivesRepository.filtres.length, 0);
});

test("getHive : l'existence d'abord (404), les droits ensuite (403)", async () => {
  const service = createHivesService({ hivesRepository: createFakeHivesRepository() });
  const api2 = { id: "u-api2", role: "apiculteur", site_id: "SN-CASA" };

  assert.equal(await service.getHive(api1, "SN-CASA-001"), ruche);
  await assert.rejects(service.getHive(api2, "SN-CASA-001"), ForbiddenError);
  await assert.rejects(service.getHive(api2, "XX-NOPE-999"), NotFoundError);
});
