/**
 * Índice numérico pilares por proveedor — calzado 654 vs confecciones 638.
 * Espejo de control_central/core/pilares/codigos.py + matriz tienda Bazzar.
 *
 * Ley: operación solo FK (linea_id…); codigo_proveedor + proveedor_id solo en catálogo.
 */

export const PROVEEDOR_CALZADO = 654;
export const PROVEEDOR_CONFECCIONES = 638;
export const TIPO_V2_CALZADO = 1;
export const TIPO_V2_CONFECCIONES = 2;
export const KYLY_REF_CODIGO_PROVEEDOR = 11;
export const KYLY_LINEA_ALPHA_BASE = 638_000_000_000;
export const KYLY_COLOR_ALPHA_BASE = 638_001_000_000;

export type RamoProveedor = "calzado" | "confecciones";

export type PilaresCodigosResueltos = {
  ramo: RamoProveedor;
  proveedor_id: number;
  tipo_v2_id: number;
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  excel_material_code: string;
  excel_color_code: string;
  /** Bigint catálogo — lookup JOIN (proveedor_id, codigo_proveedor) */
  linea_codigo_bigint: string;
  referencia_codigo_bigint: string;
  material_codigo_bigint: string;
  color_codigo_bigint: string | null;
};

const GRUPOS_CONFECCION = new Set(["10", "11", "12", "13", "14", "15"]);

/** COD.GRUPO → id_marca (validación matriz · hint si linea.marca_id NULL). */
export const GRUPO_ID_MARCA: Record<string, number> = {
  "01": 1,
  "02": 2,
  "03": 3,
  "04": 4,
  "05": 5,
  "06": 6,
  "07": 7,
  "08": 8,
  "09": 9,
  "10": 10,
  "11": 11,
  "12": 12,
  "13": 13,
  "14": 14,
  "15": 15,
};

const ADULTOS_CLIENTES = new Set([2100, 2400, 3100]);
const NINOS_CLIENTES = new Set([2900, 2700, 3200]);
const MARCAS_CALZADO_ADULTOS = new Set([1, 2, 3, 4, 7, 8, 9]);
const MARCAS_CALZADO_NINOS = new Set([5, 6]);
const MARCAS_CONFECCION = new Set([10, 11, 12, 13, 14, 15]);

function canon(s: string): string {
  const t = String(s ?? "").trim();
  if (t.endsWith(".0") && /^\d+\.0$/.test(t)) return t.slice(0, -2);
  return t;
}

function pilarCodigoToBigint(codigo: string, proveedorId: number): bigint | null {
  const s = canon(codigo);
  if (!s || s.toLowerCase() === "nan") return null;
  if (/^\d+$/.test(s)) return BigInt(s);
  if (proveedorId === PROVEEDOR_CONFECCIONES) {
    const h =
      [...s.toUpperCase()].reduce((acc, c) => acc + c.charCodeAt(0), 0) * 1_000 + s.length;
    return BigInt(KYLY_LINEA_ALPHA_BASE + h);
  }
  return null;
}

export function lineaCodigoToBigint(codigo: string, proveedorId: number): bigint | null {
  return pilarCodigoToBigint(codigo, proveedorId);
}

export function referenciaCodigoFromExcel(codigo: string): bigint | null {
  const s = canon(codigo);
  if (!s || s.toUpperCase() === "K") return BigInt(KYLY_REF_CODIGO_PROVEEDOR);
  if (/^\d+$/.test(s)) return BigInt(s);
  return pilarCodigoToBigint(s, PROVEEDOR_CONFECCIONES);
}

export function materialCodigoFromExcel(material: string, linea: string): bigint | null {
  for (const src of [material, linea]) {
    const cod = pilarCodigoToBigint(src, PROVEEDOR_CONFECCIONES);
    if (cod !== null) return cod;
  }
  return null;
}

export function colorCodigoToBigint(codigo: string, proveedorId: number): bigint | null {
  const s = canon(codigo);
  if (!s) return null;
  if (/^\d+$/.test(s)) return BigInt(s);
  if (proveedorId === PROVEEDOR_CONFECCIONES) {
    const h =
      [...s.toUpperCase()].reduce((acc, c) => acc + c.charCodeAt(0), 0) * 1_000 + s.length;
    return BigInt(KYLY_COLOR_ALPHA_BASE + h);
  }
  return null;
}

export function parseLineaReferenciaCalzado(codArt: string): { linea: string; referencia: string } {
  const t = codArt.trim();
  const i = t.indexOf("-");
  if (i === -1) return { linea: t, referencia: "" };
  return { linea: t.slice(0, i).trim(), referencia: t.slice(i + 1).trim() };
}

/** Normaliza fila Kyly — espejo confecciones_fk._normalize_kyly_excel_row */
export function normalizeKylyCsvRow(codArt: string, material: string, color: string): {
  linea: string;
  referencia: string;
  material: string;
  color: string;
} {
  const { linea: l0, referencia: r0 } = parseLineaReferenciaCalzado(codArt);
  let lc = canon(l0);
  let rc = canon(r0);
  let mat = canon(material);
  const col = canon(color);

  if (lc.toUpperCase() === "K" && /^\d+$/.test(rc)) {
    lc = rc;
    rc = "K";
  }
  if (!lc && mat) lc = mat.replace(/^K/i, "");
  if (!rc) rc = "K";
  if (!mat) mat = lc ? `K${lc}` : "";
  return { linea: lc, referencia: rc, material: mat, color: col };
}

export function classifyRamo(codArtProveedor: string, codGrupo: string): RamoProveedor {
  const g = canon(codGrupo).padStart(2, "0");
  if (GRUPOS_CONFECCION.has(g)) return "confecciones";

  const { linea, referencia } = parseLineaReferenciaCalzado(codArtProveedor);
  if (/^k$/i.test(referencia)) return "confecciones";
  if (/^\d+$/.test(linea) && /^\d+$/.test(referencia)) return "calzado";
  if (codArtProveedor.trim().toUpperCase().endsWith("-K")) return "confecciones";
  return "calzado";
}

export function resolvePilaresCodigos(input: {
  cod_art_proveedor: string;
  cod_grupo: string;
  cod_material: string;
  cod_color: string;
}): PilaresCodigosResueltos | null {
  const ramo = classifyRamo(input.cod_art_proveedor, input.cod_grupo);

  if (ramo === "calzado") {
    const { linea, referencia } = parseLineaReferenciaCalzado(input.cod_art_proveedor);
    if (!/^\d+$/.test(linea) || !/^\d+$/.test(referencia)) return null;
    const mat = canon(input.cod_material);
    const col = canon(input.cod_color);
    if (!/^\d+$/.test(mat) || !/^\d+$/.test(col)) return null;
    return {
      ramo,
      proveedor_id: PROVEEDOR_CALZADO,
      tipo_v2_id: TIPO_V2_CALZADO,
      linea_codigo_proveedor: linea,
      referencia_codigo_proveedor: referencia,
      excel_material_code: mat,
      excel_color_code: col,
      linea_codigo_bigint: linea,
      referencia_codigo_bigint: referencia,
      material_codigo_bigint: mat,
      color_codigo_bigint: col,
    };
  }

  const norm = normalizeKylyCsvRow(
    input.cod_art_proveedor,
    input.cod_material,
    input.cod_color,
  );
  const lineaBig = lineaCodigoToBigint(norm.linea, PROVEEDOR_CONFECCIONES);
  const refBig = referenciaCodigoFromExcel(norm.referencia);
  const matBig = materialCodigoFromExcel(norm.material, norm.linea);
  const colBig = norm.color
    ? colorCodigoToBigint(norm.color, PROVEEDOR_CONFECCIONES)
    : null;

  if (lineaBig === null || refBig === null || matBig === null) return null;

  return {
    ramo,
    proveedor_id: PROVEEDOR_CONFECCIONES,
    tipo_v2_id: TIPO_V2_CONFECCIONES,
    linea_codigo_proveedor: norm.linea,
    referencia_codigo_proveedor: norm.referencia.toUpperCase() === "K" ? "K" : norm.referencia,
    excel_material_code: norm.material,
    excel_color_code: norm.color,
    linea_codigo_bigint: lineaBig.toString(),
    referencia_codigo_bigint: refBig.toString(),
    material_codigo_bigint: matBig.toString(),
    color_codigo_bigint: colBig?.toString() ?? null,
  };
}

export function marcaHintFromGrupo(codGrupo: string): number | null {
  const g = canon(codGrupo).padStart(2, "0");
  return GRUPO_ID_MARCA[g] ?? null;
}

export type MatrizValidation = { ok: true } | { ok: false; reason: string };

export type CsvStockColumnHint = "S00_D1" | "S00_D2" | "S00_NINHOS";

/** Columna CSV sugerida según marca (UI redirect Palma / entes duales). */
export function suggestCsvColumnForMarca(
  marcaId: number,
  tipoV2Id: number,
): CsvStockColumnHint | null {
  if (tipoV2Id === TIPO_V2_CONFECCIONES || MARCAS_CONFECCION.has(marcaId)) {
    return "S00_NINHOS";
  }
  if (MARCAS_CALZADO_NINOS.has(marcaId)) return "S00_NINHOS";
  if (MARCAS_CALZADO_ADULTOS.has(marcaId)) return "S00_D1";
  return null;
}

export function validateColumnMarcaHint(
  csvColumn: CsvStockColumnHint,
  marcaId: number,
  tipoV2Id: number,
): MatrizValidation {
  const sug = suggestCsvColumnForMarca(marcaId, tipoV2Id);
  if (sug && sug !== csvColumn) {
    return {
      ok: false,
      reason: `marca ${marcaId} pertenece a ${sug}, no a ${csvColumn}`,
    };
  }
  return { ok: true };
}

/** Matriz tienda × tipo_v2 × marca — CHUSAR 2.3.6.4 */
export function validateMatrizTienda(
  clienteId: number,
  tipoV2Id: number,
  marcaId: number | null,
  codGrupo: string,
): MatrizValidation {
  const marca = marcaId ?? marcaHintFromGrupo(codGrupo);
  if (marca === null) {
    return { ok: false, reason: `marca no resuelta (grupo ${codGrupo})` };
  }

  /** Palma 3100 — tienda única: acepta todo el catálogo Palma; columna CSV = hint UX. */
  if (clienteId === 3100) {
    if (tipoV2Id === TIPO_V2_CONFECCIONES) {
      if (!MARCAS_CONFECCION.has(marca)) {
        return { ok: false, reason: `confección marca ${marca} no permitida en Palma` };
      }
      return { ok: true };
    }
    const calzadoPalma =
      MARCAS_CALZADO_ADULTOS.has(marca) || MARCAS_CALZADO_NINOS.has(marca);
    if (!calzadoPalma) {
      return { ok: false, reason: `marca ${marca} no es calzado Palma` };
    }
    return { ok: true };
  }

  if (ADULTOS_CLIENTES.has(clienteId)) {
    if (tipoV2Id === TIPO_V2_CONFECCIONES) {
      return { ok: false, reason: `confección en tienda adultos ${clienteId}` };
    }
    if (!MARCAS_CALZADO_ADULTOS.has(marca)) {
      return { ok: false, reason: `marca ${marca} no permitida en adultos` };
    }
    return { ok: true };
  }

  if (NINOS_CLIENTES.has(clienteId)) {
    if (tipoV2Id === TIPO_V2_CALZADO && !MARCAS_CALZADO_NINOS.has(marca)) {
      return { ok: false, reason: `calzado marca ${marca} no permitida en niños` };
    }
    if (tipoV2Id === TIPO_V2_CONFECCIONES && !MARCAS_CONFECCION.has(marca)) {
      return { ok: false, reason: `confección marca ${marca} no permitida` };
    }
    return { ok: true };
  }

  return { ok: false, reason: `cliente_id ${clienteId} fuera de matriz Bazzar` };
}
