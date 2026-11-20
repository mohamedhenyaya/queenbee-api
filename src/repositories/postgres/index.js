import { createPostgresHivesRepository } from "./hives.repository.js";
import { createPostgresMeasuresRepository } from "./measures.repository.js";
import { createPostgresInspectionsRepository } from "./inspections.repository.js";

// Les trois repositories PostgreSQL, sous les mêmes noms que createMemoryRepositories.
export function createPostgresRepositories(pool) {
  return {
    hivesRepository: createPostgresHivesRepository(pool),
    measuresRepository: createPostgresMeasuresRepository(pool),
    inspectionsRepository: createPostgresInspectionsRepository(pool),
  };
}
