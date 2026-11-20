// Repository des ruches, en PostgreSQL.
const CHAMPS = `id, site_id, owner_id, ref_lat, ref_lon, status`;

export function createPostgresHivesRepository(pool) {
  return {
    // Un filtre absent vaut null, et « $1::text IS NULL OR … » l'ignore : une seule requête
    // fixe, sans construire de SQL à la volée.
    async findAll({ site_id = null, owner_id = null } = {}) {
      const { rows } = await pool.query(
        `SELECT ${CHAMPS}
         FROM hives
         WHERE ($1::text IS NULL OR site_id = $1)
           AND ($2::uuid IS NULL OR owner_id = $2)
         ORDER BY id`,
        [site_id, owner_id],
      );
      return rows;
    },

    async findById(id) {
      const { rows } = await pool.query(`SELECT ${CHAMPS} FROM hives WHERE id = $1`, [id]);
      return rows[0] ?? null; // aucune ligne : null
    },
  };
}
