import { getRimecPool } from "@/lib/rimec/pool";

export type RetailFilterItem = { id: number; label: string };

export type RetailFiltrosPayload = {
  marcas: RetailFilterItem[];
  estilos: RetailFilterItem[];
  lineas: RetailFilterItem[];
  tipos: RetailFilterItem[];
  colores: string[];
};

export async function loadRetailFiltrosForBatch(batchId: string): Promise<RetailFiltrosPayload> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    marca_id: number | null;
    descp_marca: string | null;
    grupo_estilo_id: number | null;
    descp_grupo_estilo: string | null;
    linea_id: number | null;
    linea_code: string | null;
    tipo_1_id: number | null;
    descp_tipo_1: string | null;
    descp_color: string | null;
  }>(
    `
    SELECT DISTINCT
      s.marca_id,
      mv.descp_marca,
      s.grupo_estilo_id,
      ge.descp_grupo_estilo,
      l.id AS linea_id,
      trim(s.linea_code) AS linea_code,
      s.tipo_1_id,
      t1.descp_tipo_1,
      col.nombre AS descp_color
    FROM public.retail_multitienda_staging s
    LEFT JOIN public.linea l
      ON trim(both from s.linea_code) ~ '^[0-9]+$'
      AND (l.id = trim(s.linea_code)::bigint OR l.codigo_proveedor = trim(s.linea_code)::bigint)
    LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
    LEFT JOIN public.grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
    LEFT JOIN public.tipo_1 t1 ON t1.id_tipo_1 = s.tipo_1_id
    LEFT JOIN public.color col ON col.id = s.color_id
    WHERE s.batch_id = CAST($1 AS uuid)
    `,
    [batchId],
  );

  const marcas = new Map<number, string>();
  const estilos = new Map<number, string>();
  const lineas = new Map<number, string>();
  const tipos = new Map<number, string>();
  const colores = new Set<string>();

  for (const r of rows) {
    if (r.marca_id != null && r.descp_marca) marcas.set(r.marca_id, r.descp_marca.trim());
    if (r.grupo_estilo_id != null && r.descp_grupo_estilo)
      estilos.set(r.grupo_estilo_id, r.descp_grupo_estilo.trim());
    if (r.linea_id != null) lineas.set(r.linea_id, (r.linea_code ?? String(r.linea_id)).trim());
    if (r.tipo_1_id != null && r.descp_tipo_1) tipos.set(r.tipo_1_id, r.descp_tipo_1.trim());
    if (r.descp_color?.trim()) colores.add(r.descp_color.trim());
  }

  const sortLabel = (a: RetailFilterItem, b: RetailFilterItem) =>
    a.label.localeCompare(b.label, "es");

  return {
    marcas: [...marcas.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    estilos: [...estilos.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    lineas: [...lineas.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    tipos: [...tipos.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    colores: [...colores].sort((a, b) => a.localeCompare(b, "es")),
  };
}
