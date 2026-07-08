import type { Pool } from "pg";
import { CATEGORIA_COMPRA_PREVIA_ID, CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

export type AlzarWebPreview = {
  ok: boolean;
  ya_alzado: boolean;
  bloqueos: string[];
  avisos: string[];
  moleculas: number;
  pares_inicial: number;
  pares_saldo: number;
  filas_catalogo: number;
  estado_transito: string | null;
  listado_nombre: string | null;
  listado_estado: string | null;
};

type PpRow = {
  id: string;
  numero_registro: string;
  estado: string;
  estado_transito: string | null;
  categoria_id: string | null;
  quincena_arribo_id: string | null;
  total_articulos: string;
  evento_id: string | null;
  evento_nombre: string | null;
  evento_estado: string | null;
  n_precios: string;
};

async function loadPpAlzarContext(pool: Pool, ppId: number): Promise<PpRow | null> {
  const { rows } = await pool.query<PpRow>(
    `
    SELECT
      pp.id::text AS id,
      pp.numero_registro,
      pp.estado,
      pp.estado_transito,
      COALESCE(
        pp.categoria_id,
        (SELECT ic.categoria_id
         FROM intencion_compra_pedido icp
         JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
         WHERE icp.pedido_proveedor_id = pp.id
         ORDER BY icp.id LIMIT 1)
      )::text AS categoria_id,
      pp.quincena_arribo_id::text AS quincena_arribo_id,
      (SELECT COUNT(*)::text
       FROM pedido_proveedor_detalle ppd
       WHERE ppd.pedido_proveedor_id = pp.id AND ppd.referencia IS NOT NULL) AS total_articulos,
      pe.id::text AS evento_id,
      pe.nombre_evento AS evento_nombre,
      pe.estado AS evento_estado,
      (SELECT COUNT(*)::text FROM precio_lista pl WHERE pl.evento_id = pe.id) AS n_precios
    FROM pedido_proveedor pp
    LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id AND icp.precio_evento_id IS NOT NULL
    LEFT JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    WHERE pp.id = $1
    ORDER BY icp.id NULLS LAST
    LIMIT 1
    `,
    [ppId],
  );
  return rows[0] ?? null;
}

async function contarFilasCatalogo(pool: Pool, ppId: number): Promise<{
  moleculas: number;
  pares_inicial: number;
  pares_saldo: number;
  filas_catalogo: number;
  sin_lpn: number;
}> {
  const { rows } = await pool.query<{
    moleculas: string;
    inicial: string;
    saldo: string;
    filas: string;
    sin_lpn: string;
  }>(
    `
    WITH base AS (
      SELECT
        ppd.id,
        COALESCE(ppd.cantidad_pares, 0)::float AS inicial,
        GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0))::float AS saldo,
        EXISTS (
          SELECT 1
          FROM intencion_compra_pedido icp
          JOIN precio_lista pl ON pl.evento_id = icp.precio_evento_id
          JOIN linea l ON l.codigo_proveedor::text = ppd.linea AND l.proveedor_id = pp.proveedor_importacion_id
          JOIN referencia ref ON ref.codigo_proveedor::text = ppd.referencia AND ref.linea_id = l.id
          JOIN material m ON m.codigo_proveedor::text = ppd.material_code AND m.proveedor_id = pp.proveedor_importacion_id
          WHERE icp.pedido_proveedor_id = pp.id
            AND pl.linea_id = l.id
            AND pl.referencia_id = ref.id
            AND pl.material_id = m.id
            AND pl.lpn IS NOT NULL
          LIMIT 1
        ) AS tiene_lpn
      FROM pedido_proveedor_detalle ppd
      JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
      WHERE ppd.pedido_proveedor_id = $1
        AND ppd.referencia IS NOT NULL
    )
    SELECT
      COUNT(*)::text AS moleculas,
      COALESCE(SUM(inicial), 0)::text AS inicial,
      COALESCE(SUM(saldo), 0)::text AS saldo,
      COUNT(*) FILTER (WHERE saldo > 0)::text AS filas,
      COUNT(*) FILTER (WHERE saldo > 0 AND NOT tiene_lpn)::text AS sin_lpn
    FROM base
    `,
    [ppId],
  );
  const r = rows[0];
  return {
    moleculas: Number(r?.moleculas ?? 0),
    pares_inicial: Number(r?.inicial ?? 0),
    pares_saldo: Number(r?.saldo ?? 0),
    filas_catalogo: Number(r?.filas ?? 0),
    sin_lpn: Number(r?.sin_lpn ?? 0),
  };
}

export async function previewAlzarRimecWeb(pool: Pool, ppId: number): Promise<AlzarWebPreview> {
  const pp = await loadPpAlzarContext(pool, ppId);
  if (!pp) {
    return {
      ok: false,
      ya_alzado: false,
      bloqueos: ["PP no encontrado"],
      avisos: [],
      moleculas: 0,
      pares_inicial: 0,
      pares_saldo: 0,
      filas_catalogo: 0,
      estado_transito: null,
      listado_nombre: null,
      listado_estado: null,
    };
  }

  const bloqueos: string[] = [];
  const avisos: string[] = [];
  const categoriaId = pp.categoria_id != null ? Number(pp.categoria_id) : null;
  const yaAlzado = pp.estado_transito === "EN_TRANSITO";

  if (categoriaId === CATEGORIA_PROGRAMADO_ID) {
    bloqueos.push("PROGRAMADO no se expone en RIMEC Web (Ley 3).");
  } else if (categoriaId !== CATEGORIA_COMPRA_PREVIA_ID) {
    bloqueos.push("Solo COMPRA PREVIA (categoria_id=2) puede alzarse al catálogo mayorista.");
  }

  if (pp.estado_transito === "EN_DEPOSITO") {
    bloqueos.push("PP ya en depósito — no corresponde catálogo tránsito.");
  }

  if (Number(pp.total_articulos) <= 0) {
    bloqueos.push("Importá la proforma antes de alzar (sin moléculas PPD).");
  }

  if (!pp.quincena_arribo_id) {
    bloqueos.push("Falta quincena de arribo (Llegada) en cabecera comercial.");
  }

  if (!pp.evento_id) {
    bloqueos.push("Vinculá el listado de precios RIMEC al PP.");
  } else if (String(pp.evento_estado).toLowerCase() !== "cerrado") {
    bloqueos.push(`Listado «${pp.evento_nombre}» debe estar CERRADO (estado: ${pp.evento_estado}).`);
  } else if (Number(pp.n_precios) <= 0) {
    bloqueos.push("El listado vinculado no tiene filas en precio_lista.");
  }

  const stats = await contarFilasCatalogo(pool, ppId);
  if (stats.filas_catalogo <= 0 && Number(pp.total_articulos) > 0) {
    bloqueos.push("No hay saldo disponible (todas las moléculas agotadas).");
  }
  if (stats.sin_lpn > 0) {
    avisos.push(
      `${stats.sin_lpn} molécula(s) con saldo sin LPN en el listado — pueden no mostrar precio en catálogo.`,
    );
  }

  return {
    ok: bloqueos.length === 0,
    ya_alzado: yaAlzado,
    bloqueos,
    avisos,
    moleculas: stats.moleculas,
    pares_inicial: stats.pares_inicial,
    pares_saldo: stats.pares_saldo,
    filas_catalogo: stats.filas_catalogo,
    estado_transito: pp.estado_transito,
    listado_nombre: pp.evento_nombre,
    listado_estado: pp.evento_estado,
  };
}

export async function alzarPpEnRimecWeb(
  pool: Pool,
  ppId: number,
): Promise<{ ok: true; preview: AlzarWebPreview } | { ok: false; error: string; preview: AlzarWebPreview }> {
  const preview = await previewAlzarRimecWeb(pool, ppId);
  if (!preview.ok) {
    return { ok: false, error: preview.bloqueos[0] ?? "No se puede alzar", preview };
  }
  if (preview.ya_alzado) {
    return { ok: true, preview };
  }

  await pool.query(
    `UPDATE pedido_proveedor SET estado_transito = 'EN_TRANSITO' WHERE id = $1`,
    [ppId],
  );

  return {
    ok: true,
    preview: { ...preview, ya_alzado: true, estado_transito: "EN_TRANSITO" },
  };
}
