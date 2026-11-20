// Repository des inspections, en PostgreSQL. Mêmes méthodes que la version en mémoire.
const CHAMPS = `id, hive_id, inspected_at, colony_status, queen_present, observations,
  version, created_at, updated_at`;

export function createPostgresInspectionsRepository(pool) {
  return {
    async findById(id) {
      const { rows } = await pool.query(`SELECT ${CHAMPS} FROM inspections WHERE id = $1`, [id]);
      return rows[0] ?? null;
    },

    async findByHive(hiveId) {
      const { rows } = await pool.query(
        `SELECT ${CHAMPS} FROM inspections WHERE hive_id = $1 ORDER BY inspected_at DESC`,
        [hiveId],
      );
      return rows;
    },

    // author_id est obligatoire, mais l'authentification n'arrive qu'au TP 7 :
    // en attendant, l'auteur est le propriétaire de la ruche.
    async insert(inspection) {
      const { rows } = await pool.query(
        `INSERT INTO inspections (id, hive_id, author_id, inspected_at, colony_status,
                                  queen_present, observations)
         VALUES ($1, $2, (SELECT owner_id FROM hives WHERE id = $2), $3, $4, $5, $6)
         RETURNING ${CHAMPS}`,
        [
          inspection.id,
          inspection.hive_id,
          inspection.inspected_at,
          inspection.colony_status,
          inspection.queen_present ?? null,
          inspection.observations ?? null,
        ],
      );
      return rows[0];
    },
  };
}
