/**
 * Diagnóstico + ratificación: toda línea VIZZANO → género DAMAS.
 * Uso: npx tsx scripts/_ratify_vizzano_damas.ts [--apply]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] ??= t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });

  const generos = await pool.query<{ id: number; descripcion: string }>(
    `SELECT id, TRIM(descripcion) AS descripcion FROM genero ORDER BY id`,
  );
  const damas = generos.rows.find((g) => g.descripcion.toUpperCase() === "DAMAS");
  if (!damas) throw new Error("genero DAMAS no encontrado");

  const marcas = await pool.query<{ id_marca: number; descp_marca: string }>(
    `SELECT id_marca, TRIM(descp_marca) AS descp_marca
     FROM marca_v2
     WHERE upper(trim(descp_marca)) = 'VIZZANO'`,
  );
  if (!marcas.rows.length) throw new Error("marca VIZZANO no encontrada");
  const marcaIds = marcas.rows.map((m) => m.id_marca);

  const before = await pool.query<{ genero: string; n: number }>(
    `
    SELECT COALESCE(g.descripcion, '(NULL)') AS genero, COUNT(*)::int AS n
    FROM linea l
    LEFT JOIN genero g ON g.id = l.genero_id
    WHERE l.activo = true AND l.marca_id = ANY($1::int[])
    GROUP BY 1
    ORDER BY n DESC
    `,
    [marcaIds],
  );

  const sin = await pool.query<{ n: number }>(
    `
    SELECT COUNT(*)::int AS n
    FROM linea l
    WHERE l.activo = true
      AND l.marca_id = ANY($1::int[])
      AND (l.genero_id IS NULL OR l.genero_id <> $2)
    `,
    [marcaIds, damas.id],
  );

  console.log({
    damas_id: damas.id,
    marca_ids: marcaIds,
    before: before.rows,
    a_corregir: sin.rows[0]?.n ?? 0,
    apply: APPLY,
  });

  if (!APPLY) {
    console.log("DRY_RUN — pasar --apply para UPDATE");
    await pool.end();
    return;
  }

  const upd = await pool.query(
    `
    UPDATE linea l
    SET genero_id = $2
    WHERE l.activo = true
      AND l.marca_id = ANY($1::int[])
      AND (l.genero_id IS NULL OR l.genero_id <> $2)
    `,
    [marcaIds, damas.id],
  );

  // Ratificación explícita (idempotente): todas VIZZANO activas = DAMAS.
  const ratify = await pool.query(
    `
    UPDATE linea l
    SET genero_id = $2
    WHERE l.activo = true AND l.marca_id = ANY($1::int[])
    `,
    [marcaIds, damas.id],
  );

  const after = await pool.query<{ genero: string; n: number }>(
    `
    SELECT COALESCE(g.descripcion, '(NULL)') AS genero, COUNT(*)::int AS n
    FROM linea l
    LEFT JOIN genero g ON g.id = l.genero_id
    WHERE l.activo = true AND l.marca_id = ANY($1::int[])
    GROUP BY 1
    ORDER BY n DESC
    `,
    [marcaIds],
  );

  const nullLeft = await pool.query<{ n: number }>(
    `
    SELECT COUNT(*)::int AS n
    FROM linea l
    WHERE l.activo = true AND l.marca_id = ANY($1::int[]) AND l.genero_id IS DISTINCT FROM $2
    `,
    [marcaIds, damas.id],
  );

  const tipoCheck = await pool.query(
    `
    SELECT upper(btrim(COALESCE(lr.descp_tipo_1, ''))) AS tipo1,
           COUNT(DISTINCT l.id)::int AS lineas,
           COUNT(*) FILTER (WHERE l.genero_id = $2)::int AS con_damas
    FROM linea l
    JOIN linea_referencia lr ON lr.linea_id = l.id
    WHERE l.activo AND l.marca_id = ANY($1::int[])
      AND upper(btrim(COALESCE(lr.descp_tipo_1, '')))
          ~ 'CARTERA|ANTEOJO|LENTE|MEDIA'
    GROUP BY 1
    ORDER BY 1
    `,
    [marcaIds, damas.id],
  );

  console.log({
    updated_diff: upd.rowCount,
    ratified_all: ratify.rowCount,
    after: after.rows,
    no_damas_left: nullLeft.rows[0]?.n ?? -1,
    tipo1_accesorios: tipoCheck.rows,
  });
  if ((nullLeft.rows[0]?.n ?? 1) !== 0) throw new Error("quedan VIZZANO sin DAMAS");
  console.log("PASS_VIZZANO_DAMAS");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
