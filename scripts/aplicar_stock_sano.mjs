/**
 * Aplica migración Stock Sano + backfill ALM_WEB_01 (60 pares).
 * Uso: node scripts/aplicar_stock_sano.mjs [--solo-migracion]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const url = m?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const soloMigracion = process.argv.includes("--solo-migracion");
const ALM_WEB = 1;

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const STOCK_DET_SQL = `
WITH det AS (
  SELECT
    c.id AS combinacion_id,
    l.id AS linea_id,
    r.id AS referencia_id,
    COALESCE(mat.id, 0) AS material_id,
    l.codigo_proveedor::text AS linea,
    r.codigo_proveedor::text AS referencia,
    COALESCE(mat.descripcion, '—') AS material,
    SUM(md.cantidad * md.signo)::int AS stock,
    MAX(pl.lpn)::numeric AS lpn,
    MAX(pl.nombre_caso_aplicado) AS caso_precio
  FROM movimiento_detalle md
  JOIN movimiento m ON m.id = md.movimiento_id
  JOIN traspaso tr ON tr.numero_registro = m.documento_ref
  JOIN combinacion c ON c.id = md.combinacion_id
  JOIN linea l ON l.id = c.linea_id
  JOIN referencia r ON r.id = c.referencia_id
  LEFT JOIN material mat ON mat.id = c.material_id
  LEFT JOIN pedido_proveedor pp ON pp.id = (tr.snapshot_json->>'id_pp')::int
  LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  LEFT JOIN LATERAL (
    SELECT pl2.lpn, pl2.nombre_caso_aplicado
    FROM precio_lista pl2
    JOIN linea l2 ON l2.id = pl2.linea_id
    JOIN referencia r2 ON r2.id = pl2.referencia_id
    WHERE pl2.evento_id = icp.precio_evento_id
      AND l2.codigo_proveedor = l.codigo_proveedor
      AND r2.codigo_proveedor = r.codigo_proveedor
      AND (c.material_id IS NULL OR pl2.material_id = c.material_id)
    ORDER BY
      CASE WHEN pl2.linea_id = l.id AND pl2.referencia_id = r.id THEN 0 ELSE 1 END,
      pl2.id DESC
    LIMIT 1
  ) pl ON true
  WHERE m.almacen_destino_id = $1
    AND m.estado = 'CONFIRMADO'
    AND m.tipo = 'INGRESO_COMPRA'
  GROUP BY c.id, l.id, r.id, mat.id, mat.descripcion, l.codigo_proveedor, r.codigo_proveedor
  HAVING SUM(md.cantidad * md.signo) > 0
)
SELECT * FROM det ORDER BY linea, referencia, material, combinacion_id
`;

async function main() {
  const migPath = path.join(
    __dirname,
    "..",
    "..",
    "control_central",
    "migrations",
    "115_stock_sano_protocolo.sql",
  );
  const sql = fs.readFileSync(migPath, "utf8");
  console.log("Aplicando migración 115_stock_sano_protocolo.sql …");
  await pool.query(sql);
  console.log("Migración OK.");

  if (soloMigracion) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let lista = await client.query(
      `SELECT id FROM lista_precio WHERE tipo = 'WEB' AND almacen_id = $1 AND activa = true LIMIT 1`,
      [ALM_WEB],
    );
    let listaId = lista.rows[0]?.id;
    if (!listaId) {
      const ins = await client.query(
        `
        INSERT INTO lista_precio (nombre, tipo, almacen_id, moneda, activa)
        VALUES ('Bazzar Web ALM_WEB_01', 'WEB', $1, 'PYG', true)
        RETURNING id
        `,
        [ALM_WEB],
      );
      listaId = ins.rows[0].id;
      console.log("Lista WEB creada id=", listaId);
    }

    await client.query(
      `
      INSERT INTO stock_sano_almacen (almacen_id, lista_precio_id, protocolo_activo)
      VALUES ($1, $2, true)
      ON CONFLICT (almacen_id) DO UPDATE SET
        lista_precio_id = EXCLUDED.lista_precio_id,
        protocolo_activo = true,
        activado_en = now()
      `,
      [ALM_WEB, listaId],
    );

    const { rows: det } = await client.query(STOCK_DET_SQL, [ALM_WEB]);
    console.log(`Combinaciones en depósito: ${det.length}, pares: ${det.reduce((s, r) => s + r.stock, 0)}`);

    const tripletas = new Map();
    for (const row of det) {
      const key = `${row.linea_id}:${row.referencia_id}:${row.material_id}`;
      if (!tripletas.has(key)) {
        tripletas.set(key, {
          linea_id: row.linea_id,
          referencia_id: row.referencia_id,
          material_id: row.material_id === 0 ? null : row.material_id,
          lpn: row.lpn,
          caso: row.caso_precio,
          stock: 0,
        });
      }
      tripletas.get(key).stock += row.stock;
      if (row.lpn != null) {
        tripletas.get(key).lpn = row.lpn;
        tripletas.get(key).caso = row.caso_precio;
      }
    }

    let depositos = 0;
    let precios = 0;
    let historial = 0;

    for (const t of tripletas.values()) {
      if (t.lpn == null || !t.caso) continue;
      const calc = await client.query(
        `SELECT fn_precio_venta_web($1::numeric, $2::text)::float AS precio,
         (SELECT markup_pct FROM caso_precio_web_regla
          WHERE UPPER(TRIM(caso_codigo)) = UPPER(TRIM($2::text)) AND activo LIMIT 1)::float AS markup`,
        [t.lpn, t.caso],
      );
      const precio = calc.rows[0]?.precio;
      const markup = calc.rows[0]?.markup;
      if (!precio || precio <= 0) continue;

      const matParam = t.material_id;
      const dep = await client.query(
        `
        INSERT INTO stock_sano_deposito (
          almacen_id, linea_id, referencia_id, material_id,
          precio_venta, lpn, caso_codigo, markup_pct
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (almacen_id, linea_id, referencia_id, material_id_key) DO UPDATE SET
          precio_venta = EXCLUDED.precio_venta,
          lpn = EXCLUDED.lpn,
          caso_codigo = EXCLUDED.caso_codigo,
          markup_pct = EXCLUDED.markup_pct,
          updated_at = now()
        RETURNING id
        `,
        [ALM_WEB, t.linea_id, t.referencia_id, matParam, precio, t.lpn, t.caso, markup],
      );
      depositos += 1;
      const depId = dep.rows[0].id;

      await client.query(
        `
        INSERT INTO stock_sano_historial (
          stock_sano_deposito_id, almacen_id, linea_id, referencia_id, material_id,
          evento, precio_anterior, precio_propuesto, precio_aplicado,
          lpn_entrante, caso_entrante, decision, notas
        ) VALUES ($1,$2,$3,$4,$5,'ALTA_INICIAL',NULL,$6,$6,$7,$8,'AUTO_SANO','Backfill protocolo Stock Sano ALM_WEB_01')
        `,
        [depId, ALM_WEB, t.linea_id, t.referencia_id, matParam, precio, t.lpn, t.caso],
      );
      historial += 1;

      const combos = det.filter(
        (r) =>
          r.linea_id === t.linea_id &&
          r.referencia_id === t.referencia_id &&
          (r.material_id === 0 ? null : r.material_id) === t.material_id,
      );
      for (const c of combos) {
        await client.query(
          `UPDATE precio SET fecha_hasta = NOW() WHERE combinacion_id = $1 AND lista_id = $2 AND fecha_hasta IS NULL`,
          [c.combinacion_id, listaId],
        );
        await client.query(
          `INSERT INTO precio (combinacion_id, lista_id, valor, fecha_desde) VALUES ($1,$2,$3,NOW())`,
          [c.combinacion_id, listaId, precio],
        );
        precios += 1;
      }
    }

    await client.query("COMMIT");
    console.log({ tripletas: tripletas.size, depositos, precios_filas: precios, historial });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error("FALLÓ:", e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
