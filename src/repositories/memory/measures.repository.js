// Repository des mesures, en mémoire.
export function createMemoryMeasuresRepository(initial = []) {
  const measures = [...initial];

  return {
    async insert(measure) {
      measures.push(measure);
      return measure;
    },

    // Équivalent de : ORDER BY timestamp DESC LIMIT limit OFFSET offset
    async findByHive(hiveId, { limit, offset }) {
      return measures
        .filter((m) => m.hive_id === hiveId)
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(offset, offset + limit);
    },
  };
}
