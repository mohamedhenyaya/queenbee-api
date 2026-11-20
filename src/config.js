// Lit la configuration dans l'environnement (process.env, chargé depuis .env par --env-file).
// Une valeur invalide lève une erreur au démarrage, avec un message clair.
const NODE_ENVS = ["development", "production", "test"];

function parsePort(brut, nom, defaut) {
  const valeur = brut === undefined || brut === "" ? defaut : Number(brut);
  if (!Number.isInteger(valeur) || valeur < 1 || valeur > 65535) {
    throw new Error(`${nom} invalide (« ${brut} ») : un entier entre 1 et 65535 est attendu.`);
  }
  return valeur;
}

export function loadConfig(env = process.env) {
  const port = parsePort(env.PORT, "PORT", 3000);

  const nodeEnv = env.NODE_ENV || "development";
  if (!NODE_ENVS.includes(nodeEnv)) {
    throw new Error(`NODE_ENV invalide (« ${env.NODE_ENV} ») : ${NODE_ENVS.join(", ")} sont acceptés.`);
  }

  // Aucune valeur par défaut pour un mot de passe ou un secret : ils doivent venir de .env.
  if (!env.DB_PASSWORD) {
    throw new Error("DB_PASSWORD est obligatoire : renseignez-le dans .env.");
  }

  const poolMax = env.DB_POOL_MAX === undefined || env.DB_POOL_MAX === "" ? 10 : Number(env.DB_POOL_MAX);
  if (!Number.isInteger(poolMax) || poolMax < 1) {
    throw new Error(`DB_POOL_MAX invalide (« ${env.DB_POOL_MAX} ») : un entier positif est attendu.`);
  }

  const db = {
    host: env.DB_HOST || "localhost",
    port: parsePort(env.DB_PORT, "DB_PORT", 5432),
    user: env.DB_USER || "queenbee",
    password: env.DB_PASSWORD,
    database: env.DB_NAME || "queenbee",
    poolMax,
  };

  for (const nom of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    if (!env[nom]) {
      throw new Error(`${nom} est obligatoire : générez-le avec node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))".`);
    }
  }
  // Deux secrets distincts : un jeton de renouvellement ne doit jamais valider comme jeton d'accès.
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être différents.");
  }

  const auth = {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL || "15m",
    refreshTtl: env.JWT_REFRESH_TTL || "7d",
    maxFailedLogins: 5,
    lockMinutes: 15,
  };

  return { port, nodeEnv, db, auth };
}

// Configuration chargée une fois, au démarrage. En cas d'erreur, on s'arrête tout de suite
// avec un message clair plutôt que d'échouer plus tard, à la première requête.
export const config = (() => {
  try {
    return loadConfig();
  } catch (err) {
    console.error(`Configuration invalide : ${err.message}`);
    process.exit(1);
  }
})();
