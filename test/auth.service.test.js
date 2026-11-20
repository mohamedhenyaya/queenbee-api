import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAuthService } from "../src/services/auth.service.js";
import { UnauthorizedError } from "../src/errors.js";

// Configuration de test : des secrets jetables, jamais ceux de .env.
const auth = {
  accessSecret: "secret-acces-de-test",
  refreshSecret: "secret-renouvellement-de-test",
  accessTtl: "15m",
  refreshTtl: "7d",
  maxFailedLogins: 5,
  lockMinutes: 15,
};

const PASSWORD = "MotDePasseLong1!";
const HASH = bcrypt.hashSync(PASSWORD, 4); // coût faible : seulement pour la vitesse des tests

// Faux repository des utilisateurs, en mémoire, qui applique la même règle de blocage que le SQL.
function createFakeUsersRepository() {
  const users = [{
    id: "u-coord", email: "coord.sn-casa@queenbee.test", password_hash: HASH,
    role: "coordinateur", site_id: "SN-CASA", failed_attempts: 0, locked_until: null,
  }];
  return {
    users,
    async findByEmail(email) { return users.find((u) => u.email === email) ?? null; },
    async findById(id) {
      const u = users.find((x) => x.id === id);
      return u ? { id: u.id, email: u.email, role: u.role, site_id: u.site_id, locked_until: u.locked_until } : null;
    },
    async create({ email, password_hash, role, site_id }) {
      const u = { id: `u-${users.length + 1}`, email, password_hash, role, site_id, failed_attempts: 0, locked_until: null };
      users.push(u);
      return { id: u.id, email, role, site_id, created_at: new Date() };
    },
    async resetFailedLogins(id) {
      const u = users.find((x) => x.id === id);
      u.failed_attempts = 0;
      u.locked_until = null;
    },
    async recordFailedLogin(id, maxFailed, lockMinutes) {
      const u = users.find((x) => x.id === id);
      if (u.failed_attempts + 1 >= maxFailed) {
        u.failed_attempts = 0;
        u.locked_until = new Date(Date.now() + lockMinutes * 60_000);
      } else {
        u.failed_attempts += 1;
      }
      return u.locked_until > new Date() ? u.locked_until : null;
    },
  };
}

function messageOf(promise) {
  return promise.then(
    () => assert.fail("une UnauthorizedError était attendue"),
    (err) => {
      assert.ok(err instanceof UnauthorizedError);
      return err.message;
    },
  );
}

test("login : renvoie deux jetons, et le jeton d'accès donne l'utilisateur", async () => {
  const service = createAuthService({ usersRepository: createFakeUsersRepository(), auth });

  const tokens = await service.login("Coord.SN-CASA@queenbee.test", PASSWORD); // casse ignorée

  assert.equal(tokens.token_type, "Bearer");
  assert.deepEqual(service.verifyAccessToken(tokens.access_token), { id: "u-coord", role: "coordinateur", site_id: "SN-CASA" });
});

test("login : adresse inconnue et mauvais mot de passe donnent le même message", async () => {
  const service = createAuthService({ usersRepository: createFakeUsersRepository(), auth });

  const inconnue = await messageOf(service.login("personne@queenbee.test", "faux"));
  const fausse = await messageOf(service.login("coord.sn-casa@queenbee.test", "faux"));

  assert.equal(inconnue, "Adresse e-mail ou mot de passe incorrect.");
  assert.equal(fausse, inconnue);
});

test("login : le compte est bloqué au cinquième échec, même si le sixième essai est le bon", async () => {
  const service = createAuthService({ usersRepository: createFakeUsersRepository(), auth });

  for (let i = 1; i <= 4; i++) {
    assert.equal(await messageOf(service.login("coord.sn-casa@queenbee.test", "faux")), "Adresse e-mail ou mot de passe incorrect.");
  }
  assert.match(await messageOf(service.login("coord.sn-casa@queenbee.test", "faux")), /^Compte bloqué après 5 échecs/);
  assert.match(await messageOf(service.login("coord.sn-casa@queenbee.test", PASSWORD)), /^Compte bloqué après 5 échecs/);
});

test("un jeton de renouvellement ne passe pas pour un jeton d'accès, ni l'inverse", async () => {
  const service = createAuthService({ usersRepository: createFakeUsersRepository(), auth });
  const tokens = await service.login("coord.sn-casa@queenbee.test", PASSWORD);

  assert.throws(() => service.verifyAccessToken(tokens.refresh_token), UnauthorizedError);
  await assert.rejects(service.refresh(tokens.access_token), UnauthorizedError);
  const nouveaux = await service.refresh(tokens.refresh_token);
  assert.equal(service.verifyAccessToken(nouveaux.access_token).id, "u-coord");
});

test("verifyAccessToken refuse un jeton falsifié, expiré ou signé avec un autre algorithme", () => {
  const service = createAuthService({ usersRepository: createFakeUsersRepository(), auth });
  const base = { issuer: "queenbee-api", audience: "queenbee", subject: "u-coord" };

  // Rôle modifié sans connaître le secret : la signature ne correspond plus.
  const falsifie = jwt.sign({ type: "access", role: "admin", site_id: null }, "autre-secret", { ...base, expiresIn: "15m" });
  const expire = jwt.sign({ type: "access", role: "admin", site_id: null }, auth.accessSecret, { ...base, expiresIn: -10 });
  const sansSignature = jwt.sign({ type: "access", role: "admin", site_id: null }, null, { ...base, algorithm: "none" });

  for (const jeton of [falsifie, expire, sansSignature, "pas-un-jeton"]) {
    assert.throws(() => service.verifyAccessToken(jeton), UnauthorizedError);
  }
});

test("register : hache le mot de passe et ne renvoie jamais l'empreinte", async () => {
  const usersRepository = createFakeUsersRepository();
  const service = createAuthService({ usersRepository, auth });

  const compte = await service.register({ email: "Nouveau@queenbee.test", password: PASSWORD, role: "gestionnaire" });

  assert.equal(compte.email, "nouveau@queenbee.test");
  assert.equal(compte.site_id, null);
  assert.equal("password_hash" in compte, false);
  const enBase = usersRepository.users.at(-1);
  assert.notEqual(enBase.password_hash, PASSWORD);
  assert.ok(await bcrypt.compare(PASSWORD, enBase.password_hash));
});
