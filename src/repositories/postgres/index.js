import { createPostgresHivesRepository } from "./hives.repository.js";
import { createPostgresMeasuresRepository } from "./measures.repository.js";
import { createPostgresInspectionsRepository } from "./inspections.repository.js";
import { createUsersRepository } from "./users.repository.js";

// Les quatre repositories PostgreSQL, passés à createApp.
export function createPostgresRepositories(pool) {
  return {
    hivesRepository: createPostgresHivesRepository(pool),
    measuresRepository: createPostgresMeasuresRepository(pool),
    inspectionsRepository: createPostgresInspectionsRepository(pool),
    usersRepository: createUsersRepository(pool),
  };
}
