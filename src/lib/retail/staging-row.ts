/** Fila de staging con pilares resueltos por JOIN (lectura web = mismo idioma que Nexus). */
export type RetailStagingRow = {
  origen_tienda: string;
  tipo_movimiento: string;
  fecha_mov: string;
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  material_id: number;
  color_id: number;
  /** Código para nombre de archivo en Storage: Excel (035) si existe; si no, maestro salvo sentinela -999001. */
  material_code: string;
  color_code: string;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
  tipo_v2_id: number | null;  // NUEVO: 1=CALZADO, 2=CONFECCIONES
  grada: string;
  cantidad: number;
  sku_key: string;
  /** FK pilares (null = código Excel no encontró maestro). */
  linea_id: number | null;
  referencia_id: number | null;
  marca: string;
  genero: string;
  estilo: string;
  descp_material: string | null;
  descp_color: string | null;
  imagen_nombre: string | null;
  pilares_ok: boolean;
};

/**
 * Staging + JOIN a maestros. Reglas:
 * - linea: match por id numérico (= código en Excel) o codigo_proveedor
 * - referencia: linea_id + codigo_proveedor
 * - material / color: staging guarda FK (id) tras import; **material_code** y **color_code**
 *   en esta vista priorizan `excel_*` del Excel y evitan el codigo_proveedor sentinela -999001.
 * - marca / género / estilo: columnas materializadas en staging + JOIN descriptivos
 */
export const RETAIL_STAGING_SELECT_SQL = `
  SELECT
    s.origen_holding AS origen_tienda,
    s.tipo_movimiento,
    s.fecha_mov::text AS fecha_mov,
    s.linea_codigo_proveedor,
    s.referencia_codigo_proveedor,
    s.material_id,
    s.color_id,
    COALESCE(
      NULLIF(btrim(s.excel_material_code::text), ''),
      CASE
        WHEN mat.id IS NULL THEN NULL
        WHEN mat.codigo_proveedor = -999001::bigint THEN NULL
        ELSE trim(mat.codigo_proveedor::text)
      END,
      ''
    ) AS material_code,
    COALESCE(
      NULLIF(btrim(s.excel_color_code::text), ''),
      CASE
        WHEN col.id IS NULL THEN NULL
        WHEN col.codigo_proveedor = -999001::bigint THEN NULL
        ELSE trim(col.codigo_proveedor::text)
      END,
      ''
    ) AS color_code,
    s.marca_id,
    s.genero_id,
    s.grupo_estilo_id,
    s.tipo_1_id,
    s.tipo_v2_id,
    s.grada,
    s.cantidad::float8 AS cantidad,
    s.sku_key,
    l.id AS linea_id,
    r.id AS referencia_id,
    COALESCE(NULLIF(btrim(mv.descp_marca::text), ''), '(sin marca)') AS marca,
    COALESCE(
      NULLIF(btrim(g.descripcion::text), ''),
      NULLIF(btrim(g.codigo::text), ''),
      '(sin género)'
    ) AS genero,
    COALESCE(
      NULLIF(btrim(ge.descp_grupo_estilo::text), ''),
      '(sin estilo)'
    ) AS estilo,
    NULLIF(btrim(mat.descripcion::text), '') AS descp_material,
    NULLIF(btrim(col.nombre::text), '') AS descp_color,
    NULLIF(btrim(s.imagen_nombre::text), '') AS imagen_nombre,
    (
      l.id IS NOT NULL
      AND r.id IS NOT NULL
      AND mat.id IS NOT NULL
      AND col.id IS NOT NULL
    ) AS pilares_ok
  FROM public.registro_st_vt_rc_reposicion s
  LEFT JOIN public.linea l
    ON (
      (s.linea_id IS NOT NULL AND l.id = s.linea_id)
      OR l.codigo_proveedor = (
        CASE
          WHEN trim(both from s.linea_codigo_proveedor) ~ '^[0-9]+$'
          THEN trim(s.linea_codigo_proveedor)::bigint
        END
      )
    )
  LEFT JOIN public.referencia r
    ON (
      (s.referencia_id IS NOT NULL AND r.id = s.referencia_id)
      OR (
        r.linea_id = l.id
        AND r.codigo_proveedor = (
          CASE
            WHEN trim(both from s.referencia_codigo_proveedor) ~ '^[0-9]+$'
            THEN trim(s.referencia_codigo_proveedor)::bigint
          END
        )
      )
    )
  LEFT JOIN public.material mat ON mat.id = s.material_id
  LEFT JOIN public.color col ON col.id = s.color_id
  LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
  LEFT JOIN public.genero g ON g.id = s.genero_id
  LEFT JOIN public.grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
`;
