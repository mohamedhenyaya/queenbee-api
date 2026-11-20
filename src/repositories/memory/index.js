import { seedHives, loadSeedMeasures } from "./seed.js";
import { createMemoryHivesRepository } from "./hives.repository.js";
import { createMemoryMeasuresRepository } from "./measures.repository.js";
import { createMemoryInspectionsRepository } from "./inspections.repository.js";

// Les trois repositories en mémoire, garnis des données de départ du jour 1.
export function createMemoryRepositories() {
  return {
    hivesRepository: createMemoryHivesRepository(seedHives),
    measuresRepository: createMemoryMeasuresRepository(loadSeedMeasures()),
    inspectionsRepository: createMemoryInspectionsRepository(),
  };
}
