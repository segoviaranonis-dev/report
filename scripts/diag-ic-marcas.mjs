import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const prov = await pool.query(
  "SELECT id, nombre FROM proveedor_importacion WHERE nombre ILIKE '%BEIRA%' ORDER BY id",
);
console.log("proveedor_importacion BEIRA:", prov.rows);

const mTipo = await pool.query(`
  SELECT m.id_marca AS id, TRIM(m.descp_marca) AS label
  FROM marca_v2 m
  JOIN marca_tipo_v2 mt ON mt.id_marca = m.id_marca
  WHERE mt.id_tipo = 1
  ORDER BY label
`);
console.log("marca_tipo_v2 tipo=1:", mTipo.rows.length, "marcas");

for (const pid of [654, prov.rows[0]?.id].filter(Boolean)) {
  const fb = await pool.query(
    `
    SELECT DISTINCT m.id_marca AS id, TRIM(m.descp_marca) AS label
    FROM linea l
    JOIN marca_v2 m ON m.id_marca = l.marca_id
    WHERE l.proveedor_id = $1 AND l.activo = true
    ORDER BY label
    `,
    [pid],
  );
  console.log(`fallback linea proveedor_id=${pid}:`, fb.rows.length);
}

await pool.end();
