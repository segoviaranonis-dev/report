import type { Pool } from "pg";
import type { IcCatalogos, LineaConCaso } from "./ic-catalogos-types";

export type { IcCatalogos, LineaConCaso } from "./ic-catalogos-types";

async function loadMarcasPorTipoMap(pool: Pool): Promise<Record<number, { id: number; label: string }[]>> {
  try {
    const { rows } = await pool.query<{ tipo_id: string; id: string; label: string }>(`
      SELECT mt.id_tipo AS tipo_id, m.id_marca AS id, TRIM(m.descp_marca) AS label
      FROM marca_tipo_v2 mt
      JOIN marca_v2 m ON m.id_marca = mt.id_marca
      WHERE m.descp_marca IS NOT NULL AND TRIM(m.descp_marca) <> ''
      ORDER BY mt.id_tipo, TRIM(m.descp_marca)
    `);
    const map: Record<number, { id: number; label: string }[]> = {};
    for (const r of rows) {
      const tid = Number(r.tipo_id);
      if (!map[tid]) map[tid] = [];
      map[tid].push({ id: Number(r.id), label: r.label });
    }
    return map;
  } catch {
    return {};
  }
}

export async function loadIcCatalogos(pool: Pool): Promise<IcCatalogos> {
  const [tipos, categorias, marcas, marcasPorTipo, proveedores, vendedores, plazos, eventos, comisiones] =
    await Promise.all([
      pool.query<{ id: string; label: string }>(
        "SELECT id_tipo AS id, descp_tipo AS label FROM tipo_v2 ORDER BY descp_tipo",
      ),
      pool.query<{ id: string; label: string }>(
        "SELECT id_categoria AS id, descp_categoria AS label FROM categoria_v2 WHERE id_categoria != 1 ORDER BY descp_categoria",
      ),
      pool.query<{ id: string; label: string }>(
        "SELECT id_marca AS id, descp_marca AS label FROM marca_v2 ORDER BY descp_marca",
      ),
      loadMarcasPorTipoMap(pool),
      pool.query<{ id: string; label: string }>(
        "SELECT id, nombre AS label FROM proveedor_importacion ORDER BY nombre",
      ),
      pool.query<{ id: string; label: string }>(`
        SELECT id_vendedor AS id, TRIM(descp_vendedor) AS label
        FROM vendedor_v2
        WHERE descp_vendedor IS NOT NULL AND TRIM(descp_vendedor) <> ''
        ORDER BY TRIM(descp_vendedor)
      `),
      pool.query<{ id: string; label: string }>(
        "SELECT id_plazo AS id, descp_plazo AS label FROM plazo_v2 ORDER BY descp_plazo",
      ),
      pool.query<{ id: string; label: string; fecha: Date | null; total_skus: string }>(`
        SELECT pe.id, pe.nombre_evento AS label, pe.fecha_vigencia_desde AS fecha,
               COUNT(pl.id)::text AS total_skus
        FROM precio_evento pe
        LEFT JOIN precio_lista pl ON pl.evento_id = pe.id
        WHERE pe.estado = 'cerrado'
        GROUP BY pe.id, pe.nombre_evento, pe.fecha_vigencia_desde, pe.created_at
        ORDER BY pe.created_at DESC
      `),
      pool.query<{ id: string; label: string; porcentaje: string }>(`
        SELECT id_comision AS id, descp_comision AS label, valor_comision::text AS porcentaje
        FROM comision_v2
        ORDER BY descp_comision
      `),
    ]);

  const evOpts = eventos.rows.map((r) => ({
    id: Number(r.id),
    label: `${r.label} · ${r.fecha?.toISOString().slice(0, 10) ?? "—"} · ${Number(r.total_skus).toLocaleString("es-PY")} SKUs`,
    total_skus: Number(r.total_skus),
  }));

  return {
    tipos: tipos.rows.map((r) => ({ id: Number(r.id), label: r.label })),
    categorias: categorias.rows.map((r) => ({
      id: Number(r.id),
      label: r.label,
      raw: r.label,
    })),
    marcas: marcas.rows.map((r) => ({ id: Number(r.id), label: r.label })),
    marcasPorTipo,
    proveedores: proveedores.rows.map((r) => ({ id: Number(r.id), label: r.label })),
    vendedores: vendedores.rows.map((r) => ({ id: Number(r.id), label: r.label })),
    plazos: [
      { id: null, label: "SIN DEFINIR" },
      ...plazos.rows.map((r) => ({ id: Number(r.id), label: r.label })),
    ],
    eventos: [{ id: null, label: "— Sin vincular por ahora —" }, ...evOpts],
    comisiones: [
      { id: 0, label: "— Sin comisión —", porcentaje: 0 },
      ...comisiones.rows.map((r) => ({
        id: Number(r.id),
        label: `${r.label} (${Number(r.porcentaje).toFixed(1)}%)`,
        porcentaje: Number(r.porcentaje),
      })),
    ],
  };
}

export async function getLineasConCaso(pool: Pool, proveedorId: number): Promise<LineaConCaso[]> {
  const { rows } = await pool.query<{
    id: string;
    codigo_proveedor: string;
    descripcion: string | null;
    caso_nombre: string | null;
  }>(
    `SELECT l.id, l.codigo_proveedor, l.descripcion,
            COALESCE(cpb.nombre_caso, '') AS caso_nombre
     FROM linea l
     LEFT JOIN caso_precio_biblioteca cpb ON cpb.id = l.caso_id
     WHERE l.activo = true AND ($1::int = 0 OR l.proveedor_id = $1)
     ORDER BY l.codigo_proveedor`,
    [proveedorId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    codigo_proveedor: Number(r.codigo_proveedor),
    descripcion: r.descripcion,
    caso_nombre: r.caso_nombre || null,
  }));
}

export async function getListadosParaCaso(
  pool: Pool,
  eventoId: number,
  casoNombre: string,
): Promise<{ id: number; nombre: string }[]> {
  const { rows } = await pool.query<{ id: string; nombre: string }>(`
    SELECT DISTINCT pl.id, pl.nombre_caso_aplicado AS nombre
    FROM precio_lista pl
    JOIN precio_evento_caso pec ON pec.precio_evento_id = pl.evento_id
    WHERE pl.evento_id = $1
      AND UPPER(TRIM(pec.nombre_caso)) = UPPER(TRIM($2))
      AND pl.nombre_caso_aplicado IS NOT NULL
    ORDER BY pl.nombre_caso_aplicado
  `, [eventoId, casoNombre]);

  if (rows.length) {
    return rows.map((r) => ({ id: Number(r.id), nombre: r.nombre }));
  }

  const { rows: fallback } = await pool.query<{ id: string; nombre: string }>(`
    SELECT DISTINCT pl.id, COALESCE(pl.nombre_caso_aplicado, 'Listado') AS nombre
    FROM precio_lista pl
    WHERE pl.evento_id = $1 AND pl.nombre_caso_aplicado ILIKE $2
    LIMIT 20
  `, [eventoId, `%${casoNombre}%`]);

  return fallback.map((r) => ({ id: Number(r.id), nombre: r.nombre }));
}
