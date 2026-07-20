import type { Pool } from "pg";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

export const PP_ABIERTO_LABEL = "PP abierto";

type FilaRow = {
  linea_codigo: string;
  referencia_codigo: string;
  material_code: string;
  color_code: string;
  descp_material: string | null;
  descp_color: string | null;
  marca: string | null;
  pares: number;
  unit_fob: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
  tipo_v2_id: number | null;
  genero: string | null;
  estilo: string | null;
  tipo_v2: string | null;
  tipo_1: string | null;
};

export async function listPpAbiertoProductos(pool: Pool): Promise<{ productos: DepositoRow[] }> {
  const { rows } = await pool.query<FilaRow>(
    `SELECT
       f.linea_codigo,
       f.referencia_codigo,
       f.material_code,
       f.color_code,
       f.descp_material,
       f.descp_color,
       f.marca,
       f.pares,
       f.unit_fob::text,
       l.id AS linea_id,
       r.id AS referencia_id,
       m.id AS material_id,
       c.id AS color_id,
       l.genero_id,
       lr.grupo_estilo_id,
       lr.tipo_1_id,
       1 AS tipo_v2_id,
       TRIM(g.descripcion) AS genero,
       COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), '') AS estilo,
       COALESCE(NULLIF(TRIM(tv.descp_tipo), ''), 'Calzado') AS tipo_v2,
       t1.descp_tipo_1 AS tipo_1
     FROM pp_abierto_import_fila f
     JOIN pp_abierto_import i ON i.id = f.import_id AND i.activo = true
     LEFT JOIN linea l ON l.codigo_proveedor::text = TRIM(f.linea_codigo)
     LEFT JOIN referencia r ON r.codigo_proveedor::text = TRIM(f.referencia_codigo) AND r.linea_id = l.id
     LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = r.id
     LEFT JOIN material m ON m.codigo_proveedor::text = TRIM(f.material_code)
     LEFT JOIN color c ON c.codigo_proveedor::text = TRIM(f.color_code)
     LEFT JOIN genero g ON g.id = l.genero_id
     LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
     LEFT JOIN tipo_v2 tv ON tv.id_tipo = 1
     LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
     WHERE f.pares > 0`,
  );

  const productos: DepositoRow[] = rows.map((f) => ({
    linea_codigo_proveedor: String(f.linea_codigo),
    referencia_codigo_proveedor: String(f.referencia_codigo),
    material_code: String(f.material_code),
    color_code: String(f.color_code),
    marca: String(f.marca ?? "—"),
    genero: String(f.genero ?? ""),
    estilo: String(f.estilo ?? ""),
    tipo_v2: String(f.tipo_v2 ?? "Calzado"),
    descp_material: f.descp_material,
    descp_color: f.descp_color,
    grada: "",
    cantidad: Number(f.pares) || 0,
    imagen_nombre: null,
    linea_id: f.linea_id,
    referencia_id: f.referencia_id,
    material_id: Number(f.material_id ?? 0),
    color_id: Number(f.color_id ?? 0),
    marca_id: null,
    genero_id: f.genero_id,
    grupo_estilo_id: f.grupo_estilo_id,
    tipo_1_id: f.tipo_1_id,
    tipo_v2_id: f.tipo_v2_id ?? 1,
    tono_etiqueta: null,
    tipo_1: f.tipo_1,
    precio_unitario: f.unit_fob != null ? Number(f.unit_fob) : null,
  }));

  return { productos };
}
