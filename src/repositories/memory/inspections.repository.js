// Repository des inspections, en mémoire.
export function createMemoryInspectionsRepository(initial = []) {
  const inspections = [...initial];

  return {
    async findById(id) {
      return inspections.find((i) => i.id.toLowerCase() === id.toLowerCase()) ?? null;
    },

    async findByHive(hiveId) {
      return inspections
        .filter((i) => i.hive_id === hiveId)
        .sort((a, b) => Date.parse(b.inspected_at) - Date.parse(a.inspected_at));
    },

    async insert(inspection) {
      inspections.push(inspection);
      return inspection;
    },
  };
}
