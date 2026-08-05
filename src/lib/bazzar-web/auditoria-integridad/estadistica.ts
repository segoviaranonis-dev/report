/**
 * Estadística cruzada: Depósito (INGRESO) · Stock Sano · Bazzar Web vendible.
 * Modelo = L+R+Material · dims: tipo_v2 · marca · estilo.
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import type {
  EstadisticaDimRow,
  EstadisticaHueco,
  EstadisticaPayload,
} from "./types";

const TIPO_V2_SQL = `
  CASE l.proveedor_id
    WHEN 654 THEN 'Calzado'
    WHEN 638 THEN 'Confecciones'
    ELSE '(sin tipo)'
  END
`;

type AggSql = {
  dim: string;
  dep_modelos: number;
  dep_pares: string;
  sano_modelos: number;
  sano_pares: string;
  web_modelos: number;
  web_pares: string;
};

function mapDim(rows: AggSql[]): EstadisticaDimRow[] {
  return rows.map((r) => {
    const depM = Number(r.dep_modelos) || 0;
    const sanoM = Number(r.sano_modelos) || 0;
    const webM = Number(r.web_modelos) || 0;
    const depP = Number(r.dep_pares) || 0;
    const sanoP = Number(r.sano_pares) || 0;
    const webP = Number(r.web_pares) || 0;
    let estado: EstadisticaDimRow["estado"] = "PASS";
    if (webM < depM || webP < depP) estado = "FAIL";
    else if (sanoM < depM) estado = "WARN";
    else if (webM !== depM || webP !== depP) estado = "WARN";
    return {
      clave: r.dim || "(vacío)",
      deposito_modelos: depM,
      deposito_pares: depP,
      sano_modelos: sanoM,
      sano_pares: sanoP,
      web_modelos: webM,
      web_pares: webP,
      delta_modelos_web_dep: webM - depM,
      delta_pares_web_dep: webP - depP,
      estado,
    };
  });
}

const MODELOS_CTE = `
WITH dep AS (
  SELECT
    l.id AS linea_id,
    r.id AS referencia_id,
    COALESCE(c.material_id, 0) AS material_id,
    l.codigo_proveedor::text AS linea,
    r.codigo_proveedor::text AS referencia,
    COALESCE(NULLIF(btrim(mat.codigo_proveedor::text), ''), '0') AS material,
    COALESCE(mv.descp_marca, '—') AS marca,
    COALESCE(NULLIF(btrim(ge.descp_grupo_estilo::text), ''), '(sin estilo)') AS estilo,
    (${TIPO_V2_SQL}) AS tipo_v2,
    SUM(md.cantidad * md.signo)::bigint AS pares
  FROM movimiento_detalle md
  JOIN movimiento m ON m.id = md.movimiento_id
  JOIN combinacion c ON c.id = md.combinacion_id
  JOIN linea l ON l.id = c.linea_id
  JOIN referencia r ON r.id = c.referencia_id
  LEFT JOIN material mat ON mat.id = c.material_id
  LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
  LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = l.grupo_estilo_id
  WHERE m.almacen_destino_id = $1
    AND m.estado = 'CONFIRMADO'
    AND m.tipo = 'INGRESO_COMPRA'
  GROUP BY l.id, r.id, c.material_id, l.codigo_proveedor, r.codigo_proveedor,
           mat.codigo_proveedor, mv.descp_marca, ge.descp_grupo_estilo, l.proveedor_id
  HAVING SUM(md.cantidad * md.signo) > 0
),
sano AS (
  SELECT
    d.linea_id,
    d.referencia_id,
    d.material_id,
    d.linea,
    d.referencia,
    d.material,
    d.marca,
    d.estilo,
    d.tipo_v2,
    d.pares
  FROM dep d
  JOIN stock_sano_deposito ssd
    ON ssd.almacen_id = $1
   AND ssd.linea_id = d.linea_id
   AND ssd.referencia_id = d.referencia_id
   AND ssd.material_id_key = d.material_id
  WHERE COALESCE(ssd.precio_venta, 0) > 0
),
web AS (
  SELECT
    v.linea_id,
    v.referencia_id,
    COALESCE(v.material_id, 0) AS material_id,
    v.linea_codigo::text AS linea,
    v.referencia_codigo::text AS referencia,
    COALESCE(NULLIF(btrim(v.material_code::text), ''), '0') AS material,
    COALESCE(v.marca, '—') AS marca,
    COALESCE(NULLIF(btrim(v.descp_grupo_estilo::text), ''), '(sin estilo)') AS estilo,
    (${TIPO_V2_SQL}) AS tipo_v2,
    SUM(v.stock_web)::bigint AS pares
  FROM v_stock_web v
  JOIN linea l ON l.id = v.linea_id
  WHERE v.stock_web > 0
    AND COALESCE(v.precio_web, 0) > 0
    AND v.stock_sano_estado = 'SANO'
  GROUP BY v.linea_id, v.referencia_id, v.material_id, v.linea_codigo, v.referencia_codigo,
           v.material_code, v.marca, v.descp_grupo_estilo, l.proveedor_id
)
`;

export async function getEstadisticaCruce(): Promise<EstadisticaPayload> {
  const pool = getRimecPool();
  const alm = ALM_WEB_BAZAR;

  const runDim = async (dimCol: "tipo_v2" | "marca" | "estilo") => {
    const { rows } = await pool.query<AggSql>(
      `
      ${MODELOS_CTE}
      , unidos AS (
        SELECT
          COALESCE(d.marca, s.marca, w.marca, '—') AS marca,
          COALESCE(d.estilo, s.estilo, w.estilo, '(sin estilo)') AS estilo,
          COALESCE(d.tipo_v2, s.tipo_v2, w.tipo_v2, '(sin tipo)') AS tipo_v2,
          (d.linea_id IS NOT NULL) AS en_dep,
          (s.linea_id IS NOT NULL) AS en_sano,
          (w.linea_id IS NOT NULL) AS en_web,
          COALESCE(d.pares, 0) AS dep_pares,
          COALESCE(s.pares, 0) AS sano_pares,
          COALESCE(w.pares, 0) AS web_pares
        FROM dep d
        FULL OUTER JOIN sano s
          ON s.linea_id = d.linea_id
         AND s.referencia_id = d.referencia_id
         AND s.material_id = d.material_id
        FULL OUTER JOIN web w
          ON w.linea_id = COALESCE(d.linea_id, s.linea_id)
         AND w.referencia_id = COALESCE(d.referencia_id, s.referencia_id)
         AND w.material_id = COALESCE(d.material_id, s.material_id)
      )
      SELECT
        COALESCE(${dimCol}::text, '(vacío)') AS dim,
        COUNT(*) FILTER (WHERE en_dep)::int AS dep_modelos,
        COALESCE(SUM(dep_pares) FILTER (WHERE en_dep), 0)::text AS dep_pares,
        COUNT(*) FILTER (WHERE en_sano)::int AS sano_modelos,
        COALESCE(SUM(sano_pares) FILTER (WHERE en_sano), 0)::text AS sano_pares,
        COUNT(*) FILTER (WHERE en_web)::int AS web_modelos,
        COALESCE(SUM(web_pares) FILTER (WHERE en_web), 0)::text AS web_pares
      FROM unidos
      GROUP BY 1
      ORDER BY 1
      `,
      [alm],
    );
    return mapDim(rows);
  };

  const [por_tipo_v2, por_marca, por_estilo, huecosRes] = await Promise.all([
    runDim("tipo_v2"),
    runDim("marca"),
    runDim("estilo"),
    pool.query<{
      linea: string;
      referencia: string;
      material: string;
      marca: string;
      estilo: string;
      tipo_v2: string;
      dep_pares: string;
      sano_pares: string | null;
      web_pares: string | null;
      en_sano: boolean;
      en_web: boolean;
    }>(
      `
      ${MODELOS_CTE}
      SELECT
        d.linea, d.referencia, d.material, d.marca, d.estilo, d.tipo_v2,
        d.pares::text AS dep_pares,
        s.pares::text AS sano_pares,
        w.pares::text AS web_pares,
        (s.linea_id IS NOT NULL) AS en_sano,
        (w.linea_id IS NOT NULL) AS en_web
      FROM dep d
      LEFT JOIN sano s
        ON s.linea_id = d.linea_id
       AND s.referencia_id = d.referencia_id
       AND s.material_id = d.material_id
      LEFT JOIN web w
        ON w.linea_id = d.linea_id
       AND w.referencia_id = d.referencia_id
       AND w.material_id = d.material_id
      WHERE s.linea_id IS NULL
         OR w.linea_id IS NULL
         OR COALESCE(w.pares, 0) <> d.pares
      ORDER BY
        CASE WHEN w.linea_id IS NULL THEN 0 WHEN s.linea_id IS NULL THEN 1 ELSE 2 END,
        d.marca, d.linea, d.referencia
      LIMIT 200
      `,
      [alm],
    ),
  ]);

  const huecos: EstadisticaHueco[] = huecosRes.rows.map((r) => {
    let problema: EstadisticaHueco["problema"] = "pares_diff";
    if (!r.en_web && !r.en_sano) problema = "solo_deposito";
    else if (!r.en_web) problema = "sin_web";
    else if (!r.en_sano) problema = "sin_sano";
    return {
      linea: r.linea,
      referencia: r.referencia,
      material: r.material,
      marca: r.marca,
      estilo: r.estilo,
      tipo_v2: r.tipo_v2,
      deposito_pares: Number(r.dep_pares) || 0,
      sano_pares: r.sano_pares != null ? Number(r.sano_pares) : null,
      web_pares: r.web_pares != null ? Number(r.web_pares) : null,
      problema,
    };
  });

  const totales = {
    deposito_modelos: por_tipo_v2.reduce((s, r) => s + r.deposito_modelos, 0),
    deposito_pares: por_tipo_v2.reduce((s, r) => s + r.deposito_pares, 0),
    sano_modelos: por_tipo_v2.reduce((s, r) => s + r.sano_modelos, 0),
    sano_pares: por_tipo_v2.reduce((s, r) => s + r.sano_pares, 0),
    web_modelos: por_tipo_v2.reduce((s, r) => s + r.web_modelos, 0),
    web_pares: por_tipo_v2.reduce((s, r) => s + r.web_pares, 0),
  };

  const bloqueantes = huecos.filter(
    (h) => h.problema === "sin_web" || h.problema === "solo_deposito",
  ).length;

  return {
    ok:
      totales.deposito_modelos === totales.web_modelos &&
      totales.deposito_pares === totales.web_pares &&
      bloqueantes === 0,
    generado_en: new Date().toISOString(),
    totales,
    por_tipo_v2,
    por_marca,
    por_estilo,
    huecos,
  };
}
