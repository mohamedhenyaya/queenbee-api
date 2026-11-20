// Repository des ruches, en PostgreSQL. Mêmes méthodes que la version en mémoire.
export function createPostgresHivesRepository(pool) {
  return {
    async findAll({ site_id } = {}) {
      if (site_id) {
        const { rows } = await pool.query(
          `SELECT id, site_id, ref_lat, ref_lon, status FROM hives WHERE site_id = $1 ORDER BY id`,
          [site_id],
        );
        return rows;
      }
      const { rows } = await pool.query(
        `SELECT id, site_id, ref_lat, ref_lon, status FROM hives ORDER BY id`,
      );
      return rows;
    },

    async findById(id) {
      const { rows } = await pool.query(
        `SELECT id, site_id, ref_lat, ref_lon, status FROM hives WHERE id = $1`,
        [id],
      );
      return rows[0] ?? null; // aucune ligne : null, comme la version en mémoire
    },
  };
}
