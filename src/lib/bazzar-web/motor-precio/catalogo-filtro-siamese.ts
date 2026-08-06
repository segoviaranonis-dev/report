/**
 * Puente Motor precio → motor de filtros Stock PE / Depósito Web (hermanos siameses 2.2.1.44).
 * CASO UI = NORMAL; tipificación filtro usa COD.GRUPO (DPE) vía cadenaPeCanonico.
 */
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { normalizeDepositoRow } from "@/lib/depositos/operativa-filters";
import type { CatalogoPrecioRow } from "./types";

export function catalogoSkuKey(r: Pick<CatalogoPrecioRow, "linea" | "referencia" | "material_codigo">): string {
  return `${r.linea}|${r.referencia}|${r.material_codigo ?? ""}`;
}

/** Cadena interna filtro (REGULAR) desde CASO WEB (NORMAL). */
function cadenaInternaDesdeCaso(caso: string | null | undefined): string | null {
  const u = String(caso ?? "").trim().toUpperCase();
  if (u === "NORMAL" || u === "REGULAR" || u === "DEFAULT") return "REGULAR";
  if (u === "PROMOCIONAL" || u === "LIQUIDACION" || u === "COMUN") return u;
  return null;
}

export function catalogoRowToDepositoRow(r: CatalogoPrecioRow): DepositoRow {
  const cadena = cadenaInternaDesdeCaso(r.caso_precio);
  return normalizeDepositoRow({
    linea_codigo_proveedor: r.linea,
    referencia_codigo_proveedor: r.referencia,
    material_code: r.material_codigo ?? "0",
    color_code: r.color_codigo ?? "0",
    marca: r.marca ?? "—",
    genero: r.genero ?? "",
    estilo: r.estilo ?? "",
    tipo_v2: r.tipo_v2 ?? "",
    descp_material: r.material,
    descp_color: r.descp_color,
    grada: "—",
    cantidad: r.stock_pares,
    imagen_nombre: r.imagen_nombre,
    imagen_color_excel: r.imagen_color_excel,
    linea_id: r.linea_id,
    referencia_id: r.referencia_id,
    material_id: r.material_id ?? 0,
    color_id: r.color_id ?? 0,
    marca_id: r.marca_id,
    genero_id: r.genero_id,
    grupo_estilo_id: r.grupo_estilo_id,
    tipo_1_id: null,
    tipo_v2_id: r.tipo_v2_id,
    tono_etiqueta: null,
    tipo_1: null,
    precio_unitario: r.precio_web_calculado,
    caso_precio: r.caso_precio,
    cod_grupo: r.pe_cod_grupo,
    cadena_comercial: cadena,
    es_liquidacion: cadena === "LIQUIDACION",
    es_promo: cadena === "PROMOCIONAL" ? true : false,
  });
}

export function catalogoToDepositoRows(rows: CatalogoPrecioRow[]): DepositoRow[] {
  return rows.map(catalogoRowToDepositoRow);
}
