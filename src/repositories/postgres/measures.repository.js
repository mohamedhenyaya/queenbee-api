// Repository des mesures, en PostgreSQL. Mêmes méthodes que la version en mémoire.
// Les alias rendent au service le format de l'API : measured_at -> timestamp,
// lat/lon -> position_lat/position_lon ; site_id vient de la ruche (jointure).
const CHAMPS_RENDUS = `hive_id, measured_at AS timestamp, lat AS position_lat, lon AS position_lon,
  weight_kg, temp_internal_c, temp_external_c, humidity_pct, acoustic_activity_score, battery_pct`;

export function createPostgresMeasuresRepository(pool) {
  return {
    async insert(measure) {
      const { rows } = await pool.query(
        `INSERT INTO measures (hive_id, measured_at, lat, lon, weight_kg, temp_internal_c,
                               temp_external_c, humidity_pct, acoustic_activity_score, battery_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${CHAMPS_RENDUS}`,
        [
          measure.hive_id,
          measure.timestamp,
          measure.position_lat ?? null,
          measure.position_lon ?? null,
          measure.weight_kg,
          measure.temp_internal_c ?? null,
          measure.temp_external_c ?? null,
          measure.humidity_pct ?? null,
          measure.acoustic_activity_score ?? null,
          measure.battery_pct ?? null,
        ],
      );
      // site_id n'est pas une colonne de measures : on le reprend de la mesure reçue.
      return { ...rows[0], site_id: measure.site_id };
    },

    async findByHive(hiveId, { limit, offset }) {
      const { rows } = await pool.query(
        `SELECT m.hive_id, h.site_id, m.measured_at AS timestamp,
                m.lat AS position_lat, m.lon AS position_lon,
                m.weight_kg, m.temp_internal_c, m.temp_external_c, m.humidity_pct,
                m.acoustic_activity_score, m.battery_pct
           FROM measures m
           JOIN hives h ON h.id = m.hive_id
          WHERE m.hive_id = $1
          ORDER BY m.measured_at DESC
          LIMIT $2 OFFSET $3`,
        [hiveId, limit, offset],
      );
      return rows;
    },
  };
}
