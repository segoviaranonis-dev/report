import { getRimecPool } from "@/lib/rimec/pool";

export type RetailFilterItem = { id: number; label: string };

export type RetailFiltrosPayload = {
  generos: RetailFilterItem[];
  marcas: RetailFilterItem[];
  estilos: RetailFilterItem[];
  lineas: RetailFilterItem[];
  tipos: RetailFilterItem[];
  tipoV2: RetailFilterItem[];  // NUEVO: Calzados/Confecciones
  colores: RetailFilterItem[];
};

export const EMPTY_RETAIL_FILTROS_PAYLOAD: RetailFiltrosPayload = {
  generos: [],
  marcas: [],
  estilos: [],
  lineas: [],
  tipos: [],
  tipoV2: [],  // NUEVO
  colores: [],
};

export async function loadRetailFiltrosForBatch(batchId: string): Promise<RetailFiltrosPayload> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    genero_id: number | null;
    descp_genero: string | null;
    codigo_genero: string | null;
    marca_id: number | null;
    descp_marca: string | null;
    grupo_estilo_id: number | null;
    descp_grupo_estilo: string | null;
    linea_id: number | null;
    linea_codigo_proveedor: string | null;
    tipo_1_id: number | null;
    descp_tipo_1: string | null;
    color_id: number | null;
    descp_color: string | null;
  }>(
    `
    SELECT DISTINCT
      s.genero_id,
      g.descripcion AS descp_genero,
      g.codigo AS codigo_genero,
      s.marca_id,
      mv.descp_marca,
      s.grupo_estilo_id,
      ge.descp_grupo_estilo,
      l.id AS linea_id,
      trim(s.linea_codigo_proveedor) AS linea_codigo_proveedor,
      s.tipo_1_id,
      t1.descp_tipo_1,
      s.color_id,
      col.nombre AS descp_color
    FROM public.registro_st_vt_rc_reposicion s
    LEFT JOIN public.linea l
      ON (
        (s.linea_id IS NOT NULL AND l.id = s.linea_id)
        OR (
          trim(both from s.linea_codigo_proveedor) ~ '^[0-9]+$'
          AND (
            l.id = (
              CASE
                WHEN trim(both from s.linea_codigo_proveedor) ~ '^[0-9]+$'
                THEN trim(s.linea_codigo_proveedor)::bigint
              END
            )
            OR l.codigo_proveedor = (
              CASE
                WHEN trim(both from s.linea_codigo_proveedor) ~ '^[0-9]+$'
                THEN trim(s.linea_codigo_proveedor)::bigint
              END
            )
          )
        )
      )
    LEFT JOIN public.genero g ON g.id = s.genero_id
    LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
    LEFT JOIN public.grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
    LEFT JOIN public.tipo_1 t1 ON t1.id_tipo_1 = s.tipo_1_id
    LEFT JOIN public.color col ON col.id = s.color_id
    WHERE s.batch_id = CAST($1 AS uuid)
    `,
    [batchId],
  );

  const generos = new Map<number, string>();
  const marcas = new Map<number, string>();
  const estilos = new Map<number, string>();
  const lineas = new Map<number, string>();
  const tipos = new Map<number, string>();
  const colores = new Map<number, string>();

  for (const r of rows) {
    if (r.genero_id != null) {
      const label = r.descp_genero?.trim() || r.codigo_genero?.trim() || "(sin género)";
      generos.set(r.genero_id, label);
    }
    if (r.marca_id != null && r.descp_marca) marcas.set(r.marca_id, r.descp_marca.trim());
    if (r.grupo_estilo_id != null && r.descp_grupo_estilo)
      estilos.set(r.grupo_estilo_id, r.descp_grupo_estilo.trim());
    if (r.linea_id != null) lineas.set(r.linea_id, (r.linea_codigo_proveedor ?? String(r.linea_id)).trim());
    if (r.tipo_1_id != null && r.descp_tipo_1) tipos.set(r.tipo_1_id, r.descp_tipo_1.trim());
    if (r.color_id != null && r.descp_color?.trim()) colores.set(r.color_id, r.descp_color.trim());
  }

  const sortLabel = (a: RetailFilterItem, b: RetailFilterItem) =>
    a.label.localeCompare(b.label, "es");

  return {
    generos: [...generos.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    marcas: [...marcas.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    estilos: [...estilos.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    lineas: [...lineas.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    tipos: [...tipos.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
    // NUEVO: Tipo V2 - Valores fijos (1=CALZADO, 2=CONFECCIONES)
    tipoV2: [
      { id: 1, label: "Calzados" },
      { id: 2, label: "Confecciones" }
    ],
    colores: [...colores.entries()].map(([id, label]) => ({ id, label })).sort(sortLabel),
  };
}
