/** Runtime CLI — espejo de src/lib/depositos/pilar-proveedor-index.ts */

export const PROVEEDOR_CALZADO = 654;
export const PROVEEDOR_CONFECCIONES = 638;
export const TIPO_V2_CALZADO = 1;
export const TIPO_V2_CONFECCIONES = 2;
export const KYLY_REF_CODIGO_PROVEEDOR = 11;
export const KYLY_LINEA_ALPHA_BASE = 638_000_000_000;
export const KYLY_COLOR_ALPHA_BASE = 638_001_000_000;

const GRUPOS_CONFECCION = new Set(["10", "11", "12", "13", "14", "15"]);

export const GRUPO_ID_MARCA = {
  "01": 1, "02": 2, "03": 3, "04": 4, "05": 5, "06": 6,
  "07": 7, "08": 8, "09": 9, "10": 10, "11": 11, "12": 12,
  "13": 13, "14": 14, "15": 15,
};

const ADULTOS = new Set([2100, 2400, 3100]);
const NINOS = new Set([2900, 2700, 3200]);
const M_CALZ_ADU = new Set([1, 2, 3, 4, 7, 8, 9]);
const M_CALZ_NIN = new Set([5, 6]);
const M_CONF = new Set([10, 11, 12, 13, 14, 15]);

function canon(s) {
  const t = String(s ?? "").trim();
  if (t.endsWith(".0") && /^\d+\.0$/.test(t)) return t.slice(0, -2);
  return t;
}

function pilarCodigoToBigint(codigo, proveedorId) {
  const s = canon(codigo);
  if (!s || s.toLowerCase() === "nan") return null;
  if (/^\d+$/.test(s)) return BigInt(s);
  if (proveedorId === PROVEEDOR_CONFECCIONES) {
    const h = [...s.toUpperCase()].reduce((a, c) => a + c.charCodeAt(0), 0) * 1000 + s.length;
    return BigInt(KYLY_LINEA_ALPHA_BASE + h);
  }
  return null;
}

export function lineaCodigoToBigint(codigo, proveedorId) {
  return pilarCodigoToBigint(codigo, proveedorId);
}

export function referenciaCodigoFromExcel(codigo) {
  const s = canon(codigo);
  if (!s || s.toUpperCase() === "K") return BigInt(KYLY_REF_CODIGO_PROVEEDOR);
  if (/^\d+$/.test(s)) return BigInt(s);
  return pilarCodigoToBigint(s, PROVEEDOR_CONFECCIONES);
}

export function materialCodigoFromExcel(material, linea) {
  for (const src of [material, linea]) {
    const cod = pilarCodigoToBigint(src, PROVEEDOR_CONFECCIONES);
    if (cod !== null) return cod;
  }
  return null;
}

export function colorCodigoToBigint(codigo, proveedorId) {
  const s = canon(codigo);
  if (!s) return null;
  if (/^\d+$/.test(s)) return BigInt(s);
  if (proveedorId === PROVEEDOR_CONFECCIONES) {
    const h = [...s.toUpperCase()].reduce((a, c) => a + c.charCodeAt(0), 0) * 1000 + s.length;
    return BigInt(KYLY_COLOR_ALPHA_BASE + h);
  }
  return null;
}

function parseLR(codArt) {
  const t = codArt.trim();
  const i = t.indexOf("-");
  if (i === -1) return { linea: t, referencia: "" };
  return { linea: t.slice(0, i).trim(), referencia: t.slice(i + 1).trim() };
}

export function normalizeKylyCsvRow(codArt, material, color) {
  const { linea: l0, referencia: r0 } = parseLR(codArt);
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

export function classifyRamo(codArt, codGrupo) {
  const g = canon(codGrupo).padStart(2, "0");
  if (GRUPOS_CONFECCION.has(g)) return "confecciones";
  const { linea, referencia } = parseLR(codArt);
  if (/^k$/i.test(referencia)) return "confecciones";
  if (/^\d+$/.test(linea) && /^\d+$/.test(referencia)) return "calzado";
  if (codArt.trim().toUpperCase().endsWith("-K")) return "confecciones";
  return "calzado";
}

export function resolvePilaresCodigos(input) {
  const ramo = classifyRamo(input.cod_art_proveedor, input.cod_grupo);
  if (ramo === "calzado") {
    const { linea, referencia } = parseLR(input.cod_art_proveedor);
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
  const norm = normalizeKylyCsvRow(input.cod_art_proveedor, input.cod_material, input.cod_color);
  const lineaBig = lineaCodigoToBigint(norm.linea, PROVEEDOR_CONFECCIONES);
  const refBig = referenciaCodigoFromExcel(norm.referencia);
  const matBig = materialCodigoFromExcel(norm.material, norm.linea);
  const colBig = norm.color ? colorCodigoToBigint(norm.color, PROVEEDOR_CONFECCIONES) : null;
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

export function marcaHintFromGrupo(codGrupo) {
  const g = canon(codGrupo).padStart(2, "0");
  return GRUPO_ID_MARCA[g] ?? null;
}

export function validateMatrizTienda(clienteId, tipoV2Id, marcaId, codGrupo) {
  const marca = marcaId ?? marcaHintFromGrupo(codGrupo);
  if (marca === null) return { ok: false, reason: `marca no resuelta (grupo ${codGrupo})` };

  if (clienteId === 3100) {
    if (tipoV2Id === TIPO_V2_CONFECCIONES) {
      if (!M_CONF.has(marca)) return { ok: false, reason: `confección ${marca} no Palma` };
      return { ok: true };
    }
    if (!M_CALZ_ADU.has(marca) && !M_CALZ_NIN.has(marca)) {
      return { ok: false, reason: `marca ${marca} no calzado Palma` };
    }
    return { ok: true };
  }

  if (ADULTOS.has(clienteId)) {
    if (tipoV2Id === TIPO_V2_CONFECCIONES) return { ok: false, reason: `confección en adultos ${clienteId}` };
    if (!M_CALZ_ADU.has(marca)) return { ok: false, reason: `marca ${marca} no adultos` };
    return { ok: true };
  }
  if (NINOS.has(clienteId)) {
    if (tipoV2Id === TIPO_V2_CALZADO && !M_CALZ_NIN.has(marca)) return { ok: false, reason: `calzado ${marca} no niños` };
    if (tipoV2Id === TIPO_V2_CONFECCIONES && !M_CONF.has(marca)) return { ok: false, reason: `confección ${marca} inválida` };
    return { ok: true };
  }
  return { ok: false, reason: `cliente ${clienteId} fuera matriz` };
}
