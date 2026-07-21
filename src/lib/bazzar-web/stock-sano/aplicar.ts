/**
 * Aplica protocolo Stock Sano + publica precios WEB para stock ALM_WEB_01.
 * PE-aware: LPN/caso desde FI→PPD cuando id_pp es null en snapshot.
 */
import type { PoolClient } from "pg";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import { LPN_CASO_LATERAL_SQL, LPN_CASO_SELECT } from "@/lib/bazzar-web/motor-precio/lpn-caso-sql";

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
    ${LPN_CASO_SELECT}
  FROM movimiento_detalle md
  JOIN movimiento m ON m.id = md.movimiento_id
  JOIN traspaso tr ON tr.numero_registro = m.documento_ref
  JOIN combinacion c ON c.id = md.combinacion_id
  JOIN linea l ON l.id = c.linea_id
  JOIN referencia r ON r.id = c.referencia_id
  LEFT JOIN material mat ON mat.id = c.material_id
  LEFT JOIN pedido_proveedor pp ON pp.id = NULLIF(tr.snapshot_json->>'id_pp', '')::int
  LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  ${LPN_CASO_LATERAL_SQL}
  WHERE m.almacen_destino_id = $1
    AND m.estado = 'CONFIRMADO'
    AND m.tipo = 'INGRESO_COMPRA'
  GROUP BY c.id, l.id, r.id, mat.id, mat.descripcion, l.codigo_proveedor, r.codigo_proveedor,
           pl.lpn, pl.nombre_caso_aplicado, pe_pl.lpn, pe_pl.caso_precio
  HAVING SUM(md.cantidad * md.signo) > 0
)
SELECT * FROM det ORDER BY linea, referencia, material, combinacion_id
`;

export type AplicarStockSanoResult = {
  tripletas: number;
  depositos: number;
  precios: number;
  historial: number;
  omitidos_sin_lpn: number;
};

export async function aplicarStockSanoAlmacen(
  client: PoolClient,
  almacenId: number = ALM_WEB_BAZAR,
): Promise<AplicarStockSanoResult> {
  let lista = await client.query<{ id: number }>(
    `SELECT id FROM lista_precio WHERE tipo = 'WEB' AND almacen_id = $1 AND activa = true LIMIT 1`,
    [almacenId],
  );
  let listaId = lista.rows[0]?.id;
  if (!listaId) {
    const ins = await client.query<{ id: number }>(
      `
      INSERT INTO lista_precio (nombre, tipo, almacen_id, moneda, activa)
      VALUES ('Bazzar Web ALM_WEB_01', 'WEB', $1, 'PYG', true)
      RETURNING id
      `,
      [almacenId],
    );
    listaId = ins.rows[0]?.id;
  }
  if (!listaId) throw new Error("No se pudo resolver lista_precio WEB.");

  await client.query(
    `
    INSERT INTO stock_sano_almacen (almacen_id, lista_precio_id, protocolo_activo)
    VALUES ($1, $2, true)
    ON CONFLICT (almacen_id) DO UPDATE SET
      lista_precio_id = EXCLUDED.lista_precio_id,
      protocolo_activo = true,
      activado_en = now()
    `,
    [almacenId, listaId],
  );

  const { rows: det } = await client.query<{
    combinacion_id: number;
    linea_id: number;
    referencia_id: number;
    material_id: number;
    lpn: number | null;
    caso_precio: string | null;
    stock: number;
  }>(STOCK_DET_SQL, [almacenId]);

  const tripletas = new Map<
    string,
    {
      linea_id: number;
      referencia_id: number;
      material_id: number | null;
      lpn: number | null;
      caso: string | null;
      stock: number;
    }
  >();

  for (const row of det) {
    const key = `${row.linea_id}:${row.referencia_id}:${row.material_id}`;
    if (!tripletas.has(key)) {
      tripletas.set(key, {
        linea_id: row.linea_id,
        referencia_id: row.referencia_id,
        material_id: row.material_id === 0 ? null : row.material_id,
        lpn: row.lpn != null ? Number(row.lpn) : null,
        caso: row.caso_precio,
        stock: 0,
      });
    }
    const t = tripletas.get(key)!;
    t.stock += row.stock;
    if (row.lpn != null) {
      t.lpn = Number(row.lpn);
      t.caso = row.caso_precio;
    }
  }

  let depositos = 0;
  let precios = 0;
  let historial = 0;
  let omitidos_sin_lpn = 0;

  for (const t of tripletas.values()) {
    if (t.lpn == null || !t.caso) {
      omitidos_sin_lpn += 1;
      continue;
    }

    const calc = await client.query<{ precio: number; markup: number | null }>(
      `SELECT fn_precio_venta_web($1::numeric, $2::text)::float AS precio,
         (SELECT markup_pct FROM caso_precio_web_regla
          WHERE UPPER(TRIM(caso_codigo)) = UPPER(TRIM($2::text)) AND activo LIMIT 1)::float AS markup`,
      [t.lpn, t.caso],
    );
    const precio = calc.rows[0]?.precio;
    const markup = calc.rows[0]?.markup;
    if (!precio || precio <= 0) {
      omitidos_sin_lpn += 1;
      continue;
    }

    const matParam = t.material_id;
    const dep = await client.query<{ id: number }>(
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
      [almacenId, t.linea_id, t.referencia_id, matParam, precio, t.lpn, t.caso, markup],
    );
    depositos += 1;
    const depId = dep.rows[0].id;

    await client.query(
      `
      INSERT INTO stock_sano_historial (
        stock_sano_deposito_id, almacen_id, linea_id, referencia_id, material_id,
        evento, precio_anterior, precio_propuesto, precio_aplicado,
        lpn_entrante, caso_entrante, decision, notas
      ) VALUES ($1,$2,$3,$4,$5,'ALTA_INICIAL',NULL,$6,$6,$7,$8,'AUTO_SANO','Protocolo Stock Sano ALM_WEB_01')
      `,
      [depId, almacenId, t.linea_id, t.referencia_id, matParam, precio, t.lpn, t.caso],
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

  return {
    tripletas: tripletas.size,
    depositos,
    precios,
    historial,
    omitidos_sin_lpn,
  };
}
