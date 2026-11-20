import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors.js";

const ISSUER = "queenbee-api";
const AUDIENCE = "queenbee";
const ALGORITHM = "HS256";
const BCRYPT_COST = 10;

// Adresse inconnue ou mot de passe faux : le même message, pour qu'un attaquant ne puisse
// pas découvrir quelles adresses ont un compte.
const INVALID_CREDENTIALS = "Adresse e-mail ou mot de passe incorrect.";
// Empreinte factice : une adresse inconnue prend le même temps qu'un vrai compte.
const DUMMY_HASH = bcrypt.hashSync("mot-de-passe-factice", BCRYPT_COST);

export function createAuthService({ usersRepository, auth }) {
  // Deux secrets différents, et un champ type dans chaque jeton : un jeton de renouvellement
  // ne passe jamais pour un jeton d'accès, ni l'inverse.
  function issueTokens(user) {
    const options = { algorithm: ALGORITHM, issuer: ISSUER, audience: AUDIENCE, subject: user.id };
    return {
      token_type: "Bearer",
      access_token: jwt.sign({ type: "access", role: user.role, site_id: user.site_id }, auth.accessSecret, {
        ...options, expiresIn: auth.accessTtl,
      }),
      refresh_token: jwt.sign({ type: "refresh" }, auth.refreshSecret, { ...options, expiresIn: auth.refreshTtl }),
    };
  }

  // Bonnes pratiques de la RFC 8725 : algorithme imposé, émetteur, audience et type vérifiés.
  function verify(token, secret, expectedType) {
    try {
      const payload = jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE });
      return payload.type === expectedType ? payload : null;
    } catch {
      return null; // signature fausse, jeton expiré, jeton modifié…
    }
  }

  function lockedMessage(lockedUntil) {
    const heure = lockedUntil.toISOString().slice(11, 16);
    return `Compte bloqué après ${auth.maxFailedLogins} échecs de connexion, jusqu'à ${heure} UTC.`;
  }

  return {
    async login(email, password) {
      const user = await usersRepository.findByEmail(email.toLowerCase());
      if (!user) {
        await bcrypt.compare(password, DUMMY_HASH);
        throw new UnauthorizedError(INVALID_CREDENTIALS);
      }
      if (user.locked_until && user.locked_until > new Date()) {
        throw new UnauthorizedError(lockedMessage(user.locked_until));
      }
      const passwordOk = await bcrypt.compare(password, user.password_hash);
      if (!passwordOk) {
        const lockedUntil = await usersRepository.recordFailedLogin(user.id, auth.maxFailedLogins, auth.lockMinutes);
        throw new UnauthorizedError(lockedUntil ? lockedMessage(lockedUntil) : INVALID_CREDENTIALS);
      }
      await usersRepository.resetFailedLogins(user.id);
      return issueTokens(user);
    },

    // Nouvelle paire de jetons. L'utilisateur est relu en base : son rôle ou son site a pu
    // changer, et un compte supprimé ne doit plus obtenir de jeton.
    async refresh(refreshToken) {
      const payload = verify(refreshToken, auth.refreshSecret, "refresh");
      if (!payload) {
        throw new UnauthorizedError("Jeton de renouvellement invalide ou expiré.");
      }
      const user = await usersRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedError("Jeton de renouvellement invalide ou expiré.");
      }
      return issueTokens(user);
    },

    // Création d'un compte par l'administrateur (UC-AD01). L'empreinte n'est jamais renvoyée.
    // Une adresse déjà utilisée est refusée par la base (23505), traduite en 409 par errorHandler.
    async register({ email, password, role, site_id }) {
      const password_hash = await bcrypt.hash(password, BCRYPT_COST);
      return usersRepository.create({ email: email.toLowerCase(), password_hash, role, site_id: site_id ?? null });
    },

    verifyAccessToken(token) {
      const payload = verify(token, auth.accessSecret, "access");
      if (!payload) {
        throw new UnauthorizedError("Jeton d'accès invalide ou expiré.");
      }
      return { id: payload.sub, role: payload.role, site_id: payload.site_id };
    },
  };
}
