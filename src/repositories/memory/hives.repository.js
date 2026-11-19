// Repository des ruches, en mémoire. Les méthodes sont async : la version PostgreSQL
// du jour 2 aura la même interface, et les services ne verront pas la différence.
export function createMemoryHivesRepository(initial = []) {
  const hives = [...initial];

  return {
    async findAll({ site_id } = {}) {
      return site_id ? hives.filter((h) => h.site_id === site_id) : [...hives];
    },

    async findById(id) {
      return hives.find((h) => h.id === id) ?? null;
    },
  };
}
