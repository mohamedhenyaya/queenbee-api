// Lit la configuration dans l'environnement (process.env, chargé depuis .env par --env-file).
// Une valeur invalide lève une erreur au démarrage, avec un message clair.
const NODE_ENVS = ["development", "production", "test"];

export function loadConfig(env = process.env) {
  const port = env.PORT === undefined || env.PORT === "" ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT invalide (« ${env.PORT} ») : un entier entre 1 et 65535 est attendu.`);
  }

  const nodeEnv = env.NODE_ENV || "development";
  if (!NODE_ENVS.includes(nodeEnv)) {
    throw new Error(`NODE_ENV invalide (« ${env.NODE_ENV} ») : ${NODE_ENVS.join(", ")} sont acceptés.`);
  }

  return { port, nodeEnv };
}
