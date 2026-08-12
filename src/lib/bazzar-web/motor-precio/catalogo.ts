/**
 * Guardián de precios — stock ALM_WEB_01 + LPN/caso del evento de ingreso + fn_precio_venta_web
 * OT-510 / Director: 3 pilares L+R+Material, markup por caso (ej. +50% → 100.000 → 150.000)
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import { LPN_CASO_GROUP_BY, LPN_CASO_LATERAL_SQL, LPN_CASO_SELECT } from "./lpn-caso-sql";
import type { CatalogoPrecioRow } from "./types";
import { selloMotorDesfasado } from "./types";

/** Paridad depósito-web: tipo_v2 desde proveedor_id (no hay columna linea.tipo_v2_id). */
const TIPO_V2_ID_SQL = `
  CASE l.proveedor_id
    WHEN 654 THEN 1
    WHEN 638 THEN 2
    ELSE 1
  END
`;

/**
 * LEY 2.01.04.021 + paridad deposito-web-rows:
 * ALM post-compra suele traer codigo pilar distinto al Excel/PE.
 * Color Excel 638: PE → F9 → PPD → nombre solo si token K/dígitos → codigo pilar.
 */
const PE_IMG_LATERAL_SQL = `
  LEFT JOIN LATERAL (
    SELECT v.imagen_url, v.color_code AS pe_color_code
    FROM v_stock_pe_rimec v
    WHERE v.linea_codigo::text = l.codigo_proveedor::text
      AND v.referencia_codigo::text = r.codigo_proveedor::text
      AND NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL
      AND (
        NULLIF(btrim(v.color_code::text), '') = NULLIF(btrim(col.codigo_proveedor::text), '')
        OR NULLIF(btrim(v.material_code::text), '') = NULLIF(btrim(mat.codigo_proveedor::text), '')
        OR lower(btrim(COALESCE(v.descp_color, ''))) = lower(btrim(COALESCE(col.nombre::text, '')))
        OR (
          NULLIF(btrim(col.nombre::text), '') IS NOT NULL
          AND lower(btrim(COALESCE(v.descp_color, '')))
            LIKE lower(split_part(btrim(col.nombre::text), '/', 1)) || '%'
        )
        OR lower(btrim(COALESCE(v.descp_material, ''))) = lower(btrim(COALESCE(mat.descripcion::text, '')))
      )
    ORDER BY
      CASE WHEN NULLIF(btrim(v.color_code::text), '') = NULLIF(btrim(col.codigo_proveedor::text), '')
        THEN 0 ELSE 1 END,
      CASE WHEN lower(btrim(COALESCE(v.descp_color, ''))) = lower(btrim(COALESCE(col.nombre::text, '')))
        THEN 0 ELSE 1 END,
      CASE WHEN NULLIF(btrim(col.nombre::text), '') IS NOT NULL
        AND lower(btrim(COALESCE(v.descp_color, '')))
          LIKE lower(split_part(btrim(col.nombre::text), '/', 1)) || '%'
        THEN 0 ELSE 1 END,
      CASE WHEN NULLIF(btrim(v.material_code::text), '') = NULLIF(btrim(mat.codigo_proveedor::text), '')
        THEN 0 ELSE 1 END,
      CASE WHEN lower(btrim(COALESCE(v.descp_material, ''))) = lower(btrim(COALESCE(mat.descripcion::text, '')))
        THEN 0 ELSE 1 END,
      /* Preferir token color Excel “real” (evitar pe_color=1 basura) */
      CASE
        WHEN NULLIF(btrim(v.color_code::text), '') ~* '^k?[0-9]{3,}$' THEN 0
        ELSE 1
      END,
      v.imagen_url NULLS LAST
    LIMIT 1
  ) pe_img ON true
`;

const IMAGEN_COLOR_EXCEL_SQL = `
  CASE
    WHEN l.proveedor_id = 638 THEN COALESCE(
      NULLIF(btrim(pe_img.pe_color_code::text), ''),
      NULLIF(btrim(pw.id_color_f9::text), ''),
      NULLIF(btrim(pw.ppd_color_codigo::text), ''),
      CASE
        WHEN NULLIF(btrim(col.nombre::text), '') ~* '^k?[0-9]+$'
        THEN NULLIF(btrim(col.nombre::text), '')
        ELSE NULL
      END,
      NULLIF(btrim(col.codigo_proveedor::text), '')
    )
    ELSE NULLIF(btrim(col.nombre::text), '')
  END
`;

const CATALOGO_SQL = `
WITH det AS (
  SELECT
    l.id AS linea_id,
    r.id AS referencia_id,
    COALESCE(mat.id, 0) AS material_id,
    COALESCE(col.id, 0) AS color_id,
    l.marca_id,
    l.genero_id,
    l.grupo_estilo_id,
    l.codigo_proveedor::text AS linea,
    r.codigo_proveedor::text AS referencia,
    mat.codigo_proveedor::text AS material_codigo,
    COALESCE(NULLIF(btrim(mat.descripcion), ''), mat.codigo_proveedor::text, '—') AS material,
    col.codigo_proveedor::text AS color_codigo,
    NULLIF(btrim(col.nombre::text), '') AS descp_color,
    COALESCE(mv.descp_marca, '—') AS marca,
    COALESCE(NULLIF(btrim(g.descripcion::text), ''), NULLIF(btrim(g.codigo::text), ''), '(sin género)') AS genero,
    COALESCE(NULLIF(btrim(ge.descp_grupo_estilo::text), ''), '(sin estilo)') AS estilo,
    CASE l.proveedor_id WHEN 654 THEN 'Calzado' WHEN 638 THEN 'Confecciones' ELSE '(sin tipo)' END AS tipo_v2,
    (${IMAGEN_COLOR_EXCEL_SQL}) AS imagen_color_excel,
    NULLIF(btrim(pe_img.imagen_url::text), '') AS imagen_nombre,
    (${TIPO_V2_ID_SQL})::int AS tipo_v2_id,
    dpe.cod_grupo AS pe_cod_grupo,
    c.id AS combinacion_id,
    SUM(md.cantidad * md.signo)::int AS stock,
    ${LPN_CASO_SELECT},
    (
      SELECT p.valor
      FROM precio p
      JOIN lista_precio lp ON lp.id = p.lista_id
      WHERE p.combinacion_id = c.id
        AND p.fecha_hasta IS NULL
        AND lp.tipo = 'WEB'
        AND lp.activa = true
      ORDER BY p.id DESC
      LIMIT 1
    ) AS precio_publicado
  FROM movimiento_detalle md
  JOIN movimiento m ON m.id = md.movimiento_id
  JOIN traspaso tr ON tr.numero_registro = m.documento_ref
  JOIN combinacion c ON c.id = md.combinacion_id
  JOIN linea l ON l.id = c.linea_id
  JOIN referencia r ON r.id = c.referencia_id
  LEFT JOIN material mat ON mat.id = c.material_id
  LEFT JOIN color col ON col.id = c.color_id
  LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
  LEFT JOIN genero g ON g.id = l.genero_id
  LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = l.grupo_estilo_id
  LEFT JOIN pedido_proveedor pp ON pp.id = NULLIF(tr.snapshot_json->>'id_pp', '')::int
  LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  LEFT JOIN LATERAL (
    SELECT v.precio_web, v.id_color_f9, v.ppd_color_codigo
    FROM v_stock_web v
    WHERE v.combinacion_id = c.id
    ORDER BY CASE WHEN COALESCE(v.precio_web, 0) > 0 THEN 0 ELSE 1 END
    LIMIT 1
  ) pw ON true
  ${PE_IMG_LATERAL_SQL}
  ${LPN_CASO_LATERAL_SQL}
  WHERE m.almacen_destino_id = $1
    AND m.estado = 'CONFIRMADO'
    AND m.tipo = 'INGRESO_COMPRA'
  GROUP BY l.id, r.id, mat.id, col.id, l.marca_id, l.genero_id, l.grupo_estilo_id,
           l.codigo_proveedor, r.codigo_proveedor, mat.codigo_proveedor, mat.descripcion,
           col.codigo_proveedor, col.nombre, l.proveedor_id, c.id,
           mv.descp_marca, g.descripcion, g.codigo, ge.descp_grupo_estilo,
           pe_img.pe_color_code, pe_img.imagen_url, pw.id_color_f9, pw.ppd_color_codigo,
           dpe.cod_grupo,
           ${LPN_CASO_GROUP_BY}
  HAVING SUM(md.cantidad * md.signo) > 0
),
agg AS (
  SELECT
    linea,
    referencia,
    material_codigo,
    MAX(material) AS material,
    MAX(color_codigo) AS color_codigo,
    MAX(descp_color) AS descp_color,
    MAX(imagen_color_excel) AS imagen_color_excel,
    MAX(imagen_nombre) AS imagen_nombre,
    MAX(tipo_v2_id)::int AS tipo_v2_id,
    MAX(tipo_v2) AS tipo_v2,
    MAX(linea_id)::int AS linea_id,
    MAX(referencia_id)::int AS referencia_id,
    MAX(material_id)::int AS material_id,
    MAX(color_id)::int AS color_id,
    MAX(marca_id)::int AS marca_id,
    MAX(genero_id)::int AS genero_id,
    MAX(grupo_estilo_id)::int AS grupo_estilo_id,
    MAX(marca) AS marca,
    MAX(genero) AS genero,
    MAX(estilo) AS estilo,
    MAX(pe_cod_grupo) AS pe_cod_grupo,
    SUM(stock)::int AS stock_pares,
    MAX(lpn)::float AS lpn,
    MAX(caso_precio) AS caso_precio,
    (
      SELECT markup_pct FROM caso_precio_web_regla cpr
      WHERE UPPER(TRIM(cpr.caso_codigo)) = UPPER(TRIM(COALESCE(MAX(caso_precio), 'DEFAULT')))
        AND cpr.activo = true
      LIMIT 1
    )::float AS markup_pct,
    fn_precio_venta_web(MAX(lpn), MAX(caso_precio))::float AS precio_web_calculado,
    MAX(precio_publicado)::float AS precio_web_publicado,
    COUNT(DISTINCT combinacion_id)::int AS combinaciones
  FROM det
  GROUP BY linea, referencia, material_codigo
)
SELECT
  a.*,
  (s.linea_id IS NOT NULL) AS motor_sellado,
  s.precio_sellado::float AS precio_motor_sellado,
  CASE
    WHEN s.linea_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM combinacion c
      JOIN precio p ON p.combinacion_id = c.id
      JOIN lista_precio lp ON lp.id = p.lista_id AND lp.tipo = 'WEB'
      WHERE c.linea_id = a.linea_id
        AND c.referencia_id = a.referencia_id
        AND COALESCE(c.material_id, 0) = COALESCE(NULLIF(a.material_id, 0), 0)
        AND ROUND(p.valor) = ROUND(s.precio_sellado)
    )
  END AS sello_respaldado_web
FROM agg a
LEFT JOIN motor_precio_sello s
  ON s.almacen_id = $1
 AND s.linea_id = a.linea_id
 AND s.referencia_id = a.referencia_id
 AND s.material_id = COALESCE(NULLIF(a.material_id, 0), 0)
ORDER BY a.linea, a.referencia, a.material_codigo
`;

export async function getCatalogoPrecios(): Promise<CatalogoPrecioRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material: string;
    material_codigo: string | null;
    color_codigo: string | null;
    descp_color: string | null;
    imagen_color_excel: string | null;
    imagen_nombre: string | null;
    tipo_v2_id: number | null;
    tipo_v2: string | null;
    linea_id: number | null;
    referencia_id: number | null;
    material_id: number | null;
    color_id: number | null;
    marca_id: number | null;
    genero_id: number | null;
    grupo_estilo_id: number | null;
    marca: string | null;
    genero: string | null;
    estilo: string | null;
    pe_cod_grupo: string | null;
    stock_pares: number;
    lpn: number | null;
    caso_precio: string | null;
    markup_pct: number | null;
    precio_web_calculado: number | null;
    precio_web_publicado: number | null;
    motor_sellado: boolean;
    precio_motor_sellado: number | null;
    sello_respaldado_web: boolean;
    combinaciones: number;
  }>(CATALOGO_SQL, [ALM_WEB_BAZAR]);

  return rows.map((r) => ({
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    material_codigo: r.material_codigo,
    color_codigo: r.color_codigo,
    descp_color: r.descp_color,
    imagen_color_excel: r.imagen_color_excel,
    imagen_nombre: r.imagen_nombre,
    tipo_v2_id: r.tipo_v2_id != null ? Number(r.tipo_v2_id) : null,
    tipo_v2: r.tipo_v2,
    linea_id: r.linea_id != null ? Number(r.linea_id) : null,
    referencia_id: r.referencia_id != null ? Number(r.referencia_id) : null,
    material_id: r.material_id != null ? Number(r.material_id) : null,
    color_id: r.color_id != null ? Number(r.color_id) : null,
    marca_id: r.marca_id != null ? Number(r.marca_id) : null,
    genero_id: r.genero_id != null ? Number(r.genero_id) : null,
    grupo_estilo_id: r.grupo_estilo_id != null ? Number(r.grupo_estilo_id) : null,
    marca: r.marca,
    genero: r.genero,
    estilo: r.estilo,
    pe_cod_grupo: r.pe_cod_grupo,
    stock_pares: Number(r.stock_pares) || 0,
    lpn: r.lpn != null ? Number(r.lpn) : null,
    caso_precio: r.caso_precio,
    markup_pct: r.markup_pct != null ? Number(r.markup_pct) : null,
    precio_rimec_lpn: r.lpn != null ? Number(r.lpn) : null,
    precio_web_calculado:
      r.precio_web_calculado != null ? Number(r.precio_web_calculado) : null,
    precio_web_publicado:
      r.precio_web_publicado != null ? Number(r.precio_web_publicado) : null,
    motor_sellado: Boolean(r.motor_sellado),
    sello_respaldado_web: Boolean(r.sello_respaldado_web),
    precio_motor_sellado:
      r.precio_motor_sellado != null ? Number(r.precio_motor_sellado) : null,
    combinaciones: Number(r.combinaciones) || 0,
    sin_precio: r.lpn == null || r.precio_web_calculado == null,
  }));
}

export type ModoPublicacion = "nuevo" | "publicado";

type ComboPubRow = {
  combinacion_id: number;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  linea: string;
  referencia: string;
  material_codigo: string | null;
  lpn: number;
  caso_precio: string;
  precio_calc: number;
  precio_publicado: number | null;
  precio_sellado: number | null;
};

async function loadCombosPublicables(
  client: import("pg").PoolClient,
): Promise<ComboPubRow[]> {
  const { rows } = await client.query<{
    combinacion_id: number;
    linea_id: number;
    referencia_id: number;
    material_id: number;
    linea: string;
    referencia: string;
    material_codigo: string | null;
    lpn: number;
    caso_precio: string;
    precio_calc: number;
    precio_publicado: number | null;
    precio_sellado: number | null;
  }>(
    `
    WITH det AS (
      SELECT
        c.id AS combinacion_id,
        l.id AS linea_id,
        r.id AS referencia_id,
        COALESCE(mat.id, 0) AS material_id,
        l.codigo_proveedor::text AS linea,
        r.codigo_proveedor::text AS referencia,
        mat.codigo_proveedor::text AS material_codigo,
        ${LPN_CASO_SELECT},
        SUM(md.cantidad * md.signo) AS stock
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
      GROUP BY c.id, l.id, r.id, mat.id, l.codigo_proveedor, r.codigo_proveedor, mat.codigo_proveedor,
               ${LPN_CASO_GROUP_BY}
      HAVING SUM(md.cantidad * md.signo) > 0
    )
    SELECT
      combinacion_id,
      linea_id,
      referencia_id,
      material_id,
      linea,
      referencia,
      material_codigo,
      lpn::float AS lpn,
      caso_precio,
      fn_precio_venta_web(lpn, caso_precio)::float AS precio_calc,
      (
        SELECT p.valor::float
        FROM precio p
        JOIN lista_precio lp ON lp.id = p.lista_id
        WHERE p.combinacion_id = det.combinacion_id
          AND p.fecha_hasta IS NULL
          AND lp.tipo = 'WEB'
          AND lp.activa = true
        ORDER BY p.id DESC
        LIMIT 1
      ) AS precio_publicado,
      (
        SELECT s.precio_sellado::float
        FROM motor_precio_sello s
        WHERE s.almacen_id = $1
          AND s.linea_id = det.linea_id
          AND s.referencia_id = det.referencia_id
          AND s.material_id = det.material_id
        LIMIT 1
      ) AS precio_sellado
    FROM det
    WHERE lpn IS NOT NULL AND caso_precio IS NOT NULL
    `,
    [ALM_WEB_BAZAR],
  );
  return rows.map((r) => ({
    combinacion_id: Number(r.combinacion_id),
    linea_id: Number(r.linea_id),
    referencia_id: Number(r.referencia_id),
    material_id: Number(r.material_id) || 0,
    linea: r.linea,
    referencia: r.referencia,
    material_codigo: r.material_codigo,
    lpn: Number(r.lpn),
    caso_precio: r.caso_precio,
    precio_calc: Number(r.precio_calc),
    precio_publicado: r.precio_publicado != null ? Number(r.precio_publicado) : null,
    precio_sellado: r.precio_sellado != null ? Number(r.precio_sellado) : null,
  }));
}

function skuKeyCombo(r: Pick<ComboPubRow, "linea" | "referencia" | "material_codigo">): string {
  return `${r.linea}|${r.referencia}|${r.material_codigo ?? ""}`;
}

async function escribirPrecioCombo(
  client: import("pg").PoolClient,
  listaId: number,
  combinacionId: number,
  precio: number,
): Promise<void> {
  await client.query(
    `UPDATE precio SET fecha_hasta = NOW()
     WHERE combinacion_id = $1 AND lista_id = $2 AND fecha_hasta IS NULL`,
    [combinacionId, listaId],
  );
  await client.query(
    `INSERT INTO precio (combinacion_id, lista_id, valor, fecha_desde)
     VALUES ($1, $2, $3, NOW())`,
    [combinacionId, listaId, precio],
  );
}

/**
 * Publica por selección L+R+Mat · 2.5.1.22
 * - nuevo: escribe precio calculado (actualiza vitrina)
 * - publicado: mantiene/reafirma precio ya publicado (stock nuevo al precio vigente)
 */
export async function publicarPreciosWebSeleccion(
  keys: string[],
  modo: ModoPublicacion = "nuevo",
): Promise<{
  ok: boolean;
  publicados: number;
  omitidos: number;
  error?: string;
}> {
  const keySet = new Set(keys.map((k) => k.trim()).filter(Boolean));
  if (!keySet.size) {
    return { ok: false, publicados: 0, omitidos: 0, error: "Sin SKUs seleccionados." };
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lista = await client.query<{ id: number }>(
      `SELECT id FROM lista_precio WHERE tipo = 'WEB' AND activa = true ORDER BY id LIMIT 1`,
    );
    const listaId = lista.rows[0]?.id;
    if (!listaId) {
      await client.query("ROLLBACK");
      return { ok: false, publicados: 0, omitidos: 0, error: "No hay lista_precio WEB activa." };
    }

    const combos = await loadCombosPublicables(client);
    let publicados = 0;
    let omitidos = 0;
    const sellados = new Map<string, { precio: number; caso: string; row: ComboPubRow }>();

    for (const row of combos) {
      if (!keySet.has(skuKeyCombo(row))) continue;

      let precio: number;
      if (modo === "publicado") {
        /** Ley 2.5.1.22: “mantener publicado” = vitrina WEB viva, nunca sello de auditoría viejo. */
        const vigente = row.precio_publicado ?? row.precio_sellado;
        if (vigente == null || !(vigente > 0)) {
          omitidos += 1;
          continue;
        }
        precio = Math.round(Number(vigente));
      } else {
        precio = Math.round(Number(row.precio_calc));
      }

      if (!Number.isFinite(precio) || precio <= 0) {
        omitidos += 1;
        continue;
      }

      await escribirPrecioCombo(client, listaId, row.combinacion_id, precio);
      publicados += 1;
      const tkey = `${row.linea_id}:${row.referencia_id}:${row.material_id}`;
      sellados.set(tkey, { precio, caso: row.caso_precio, row });
    }

    for (const { precio, caso, row } of sellados.values()) {
      await client.query(
        `
        INSERT INTO motor_precio_sello (
          almacen_id, linea_id, referencia_id, material_id,
          precio_sellado, caso_codigo, modo, publicado_en
        ) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
        ON CONFLICT (almacen_id, linea_id, referencia_id, material_id) DO UPDATE SET
          precio_sellado = EXCLUDED.precio_sellado,
          caso_codigo = EXCLUDED.caso_codigo,
          modo = EXCLUDED.modo,
          publicado_en = now()
        `,
        [
          ALM_WEB_BAZAR,
          row.linea_id,
          row.referencia_id,
          row.material_id,
          precio,
          caso,
          modo,
        ],
      );
    }

    await client.query("COMMIT");
    return { ok: true, publicados, omitidos };
  } catch (e) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      publicados: 0,
      omitidos: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    client.release();
  }
}

/** @deprecated Preferir publicarPreciosWebSeleccion — publica TODO el catálogo */
export async function publicarPreciosWeb(): Promise<{
  ok: boolean;
  publicados: number;
  omitidos: number;
  error?: string;
}> {
  const rows = await getCatalogoPrecios();
  const keys = [
    ...new Set(
      rows
        .filter((r) => !r.sin_precio)
        .map((r) => `${r.linea}|${r.referencia}|${r.material_codigo ?? ""}`),
    ),
  ];
  return publicarPreciosWebSeleccion(keys, "nuevo");
}

/**
 * Autocura segura: si vitrina WEB ya = calculado pero el sello quedó viejo,
 * alinea el sello (auditoría) sin tocar precio de tienda.
 * No crea sellos nuevos · no publica · no pisa conflictos reales (calc ≠ pub).
 */
export async function repararSellosDesfasadosAlineados(
  rows: CatalogoPrecioRow[],
): Promise<{ reparados: number }> {
  const stale = rows.filter(selloMotorDesfasado);
  if (!stale.length) return { reparados: 0 };

  const pool = getRimecPool();
  let reparados = 0;
  for (const r of stale) {
    if (r.linea_id == null || r.referencia_id == null) continue;
    const precio = Math.round(Number(r.precio_web_publicado ?? r.precio_web_calculado));
    if (!Number.isFinite(precio) || precio <= 0) continue;
    const matId = Number(r.material_id) || 0;
    const res = await pool.query(
      `
      UPDATE motor_precio_sello
      SET precio_sellado = $5,
          caso_codigo = COALESCE($6, caso_codigo),
          publicado_en = now()
      WHERE almacen_id = $1
        AND linea_id = $2
        AND referencia_id = $3
        AND material_id = $4
        AND precio_sellado IS DISTINCT FROM $5::numeric
      `,
      [ALM_WEB_BAZAR, r.linea_id, r.referencia_id, matId, precio, r.caso_precio],
    );
    reparados += res.rowCount ?? 0;
  }
  return { reparados };
}

/**
 * Borra sellos sin eco en lista WEB (publicar-todo / sello fantasma).
 * Alcance: todo el almacén WEB · no toca precios · deja 1ª PUB real.
 */
export async function purgarSellosHuerfanos(
  _rows?: CatalogoPrecioRow[],
): Promise<{ purgados: number }> {
  const pool = getRimecPool();
  const res = await pool.query(
    `
    DELETE FROM motor_precio_sello s
    WHERE s.almacen_id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM combinacion c
        JOIN precio p ON p.combinacion_id = c.id
        JOIN lista_precio lp ON lp.id = p.lista_id AND lp.tipo = 'WEB'
        WHERE c.linea_id = s.linea_id
          AND c.referencia_id = s.referencia_id
          AND COALESCE(c.material_id, 0) = s.material_id
          AND ROUND(p.valor) = ROUND(s.precio_sellado)
      )
    `,
    [ALM_WEB_BAZAR],
  );
  return { purgados: res.rowCount ?? 0 };
}
