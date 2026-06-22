import * as XLSX from "xlsx";

export type SkuStagingRow = {
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  descripcion: string;
  fob_fabrica: number;
};

const SKIP_HDR = new Set([
  "STYLE",
  "REF",
  "REFERENCIA",
  "MATERIAL",
  "MATERIAL CODE",
  "MAT",
  "UNIT",
  "USD",
  "FOB",
  "PRECIO",
  "LINEA",
  "LÍNEA",
  "DESCRIPCION",
  "DESCRIPCIÓN",
]);

function parseFob(val: unknown): number | null {
  if (val == null || val === "") return null;
  const s = String(val).trim().replace(",", ".");
  if (!s || s === "nan" || s === "None" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Layout Bacera A–E — paridad `_extraer_hoja_layout_bacera`. */
function extraerHojaLayoutBacera(rows: unknown[][], marca: string): SkuStagingRow[] {
  if (!rows.length || (rows[0]?.length ?? 0) < 5) return [];

  const out: SkuStagingRow[] = [];
  for (const row of rows) {
    const linea = String(row[0] ?? "").trim();
    const referencia = String(row[1] ?? "").trim();
    const materialRaw = String(row[2] ?? "").trim();
    const descripcionRaw = String(row[3] ?? "").trim();
    const fob = parseFob(row[4]);
    if (fob == null) continue;
    if (!referencia || ["nan", "none", "—", "-"].includes(referencia.toLowerCase())) continue;
    if (SKIP_HDR.has(referencia.toUpperCase())) continue;
    if (!linea || ["nan", "none", "—", "-"].includes(linea.toLowerCase())) continue;
    if (SKIP_HDR.has(linea.toUpperCase())) continue;

    const material = ["nan", "none"].includes(materialRaw.toLowerCase()) ? "—" : materialRaw;
    const descripcion = ["nan", "none"].includes(descripcionRaw.toLowerCase()) ? "" : descripcionRaw;

    out.push({ marca, linea, referencia, material, descripcion, fob_fabrica: fob });
  }
  return out;
}

function mapearColumnas(cols: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  cols.forEach((c, idx) => {
    const cu = String(c).toUpperCase().trim();
    if (!mapping.fob && /FOB|PRECIO|COSTO|PRICE|UNIT|USD/.test(cu)) mapping.fob = idx;
    if (!mapping.referencia && /REF|MODELO|ARTICULO|ARTÍCULO|SKU/.test(cu)) mapping.referencia = idx;
    if (!mapping.linea && /STYLE|LINEA|LÍNEA|LINHA|LINE|LIN\.|GRUPO|GRP/.test(cu)) mapping.linea = idx;
    if (!mapping.descripcion && /DESC/.test(cu)) mapping.descripcion = idx;
    if (!mapping.material && /MATERIAL|MATER|MAT|ACAB|CABEDAL|CAB\.|UPPER|CODE/.test(cu)) {
      if (cu.includes("CODE") && !cu.includes("MATERIAL") && mapping.material != null) return;
      mapping.material = idx;
    }
  });
  return mapping;
}

/** Fallback: encabezados por nombre (paridad `_extraer_hoja_por_nombres` simplificada). */
function extraerHojaPorNombres(rows: unknown[][], marca: string): SkuStagingRow[] {
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const rowStr = (rows[i] ?? []).map((v) => String(v ?? "").toUpperCase()).join(" ");
    if (/FOB|PRECIO|COSTO|REFERENCIA|REF|UNIT|USD/.test(rowStr)) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return [];

  const headers = (rows[headerRow] ?? []).map((c) => String(c ?? "").trim());
  const col = mapearColumnas(headers);
  if (col.fob == null || (col.referencia == null && col.linea == null)) return [];

  const out: SkuStagingRow[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const linea = col.linea != null ? String(row[col.linea] ?? "").trim() : "";
    const referencia = col.referencia != null ? String(row[col.referencia] ?? "").trim() : "";
    const materialRaw = col.material != null ? String(row[col.material] ?? "").trim() : "—";
    const descripcionRaw = col.descripcion != null ? String(row[col.descripcion] ?? "").trim() : "";
    const fob = parseFob(col.fob != null ? row[col.fob] : null);
    if (fob == null) continue;
    const ref = referencia || linea;
    const lin = linea || referencia;
    if (!ref || !lin) continue;
    if (SKIP_HDR.has(ref.toUpperCase()) || SKIP_HDR.has(lin.toUpperCase())) continue;
    out.push({
      marca,
      linea: lin,
      referencia: ref,
      material: ["nan", "none"].includes(materialRaw.toLowerCase()) ? "—" : materialRaw,
      descripcion: ["nan", "none"].includes(descripcionRaw.toLowerCase()) ? "" : descripcionRaw,
      fob_fabrica: fob,
    });
  }
  return out;
}

/** Lee Excel proveedor — cada hoja = marca. Layout según proveedor_id (654 calzado). */
export function leerExcelProveedor(buffer: Buffer, _nombreArchivo: string, proveedorId: number): {
  marcas: string[];
  skus: SkuStagingRow[];
  error: string | null;
} {
  if (proveedorId === 638) {
    return {
      marcas: [],
      skus: [],
      error:
        "Excel confecciones (638) requiere parser dedicado — no uses archivos Beira Rio.\nPaso 0 Report para 638 en construcción.",
    };
  }
  if (proveedorId !== 654) {
    return { marcas: [], skus: [], error: `Proveedor ${proveedorId}: parser Excel no configurado.` };
  }

  try {
    const wb = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      raw: true,
    });
    const frames: SkuStagingRow[] = [];
    const razones: string[] = [];

    for (const hoja of wb.SheetNames) {
      const sheet = wb.Sheets[hoja];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
      const parsed = extraerHojaLayoutBacera(rows, hoja);
      if (parsed.length) {
        frames.push(...parsed);
      } else {
        const legacy = extraerHojaPorNombres(rows, hoja);
        if (legacy.length) frames.push(...legacy);
        else razones.push(`Hoja '${hoja}': sin datos (probó layout A–E y encabezados por nombre)`);
      }
    }

    if (!frames.length) {
      return {
        marcas: [],
        skus: [],
        error: `No se encontraron hojas con datos válidos.\n\n${razones.map((r) => `- ${r}`).join("\n")}`,
      };
    }

    const marcas = [...new Set(frames.map((s) => s.marca))];
    return { marcas, skus: frames, error: null };
  } catch (e) {
    return {
      marcas: [],
      skus: [],
      error: e instanceof Error ? e.message : "Error leyendo Excel",
    };
  }
}

export function nombreEventoSugerido(nombreArchivo: string): string {
  return nombreArchivo.replace(/\.(xlsx|xls)$/i, "").trim();
}

/** Nombre libre — si el usuario no escribe nada, sugerimos desde archivo (sin obligar patrón Hiedra). */
export function resolverNombreEvento(nombreEvento: string | null | undefined, nombreArchivo: string): string {
  const manual = String(nombreEvento ?? "").trim();
  if (manual) return manual;
  const sugerido = nombreEventoSugerido(nombreArchivo);
  return sugerido || "LISTADO_PRECIOS";
}
