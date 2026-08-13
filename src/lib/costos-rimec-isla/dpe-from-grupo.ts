import { GRUPO_DIGITO_MARCA, normGrupoLabel } from "@/lib/pilares/cod-grupo-decode";
import type { CostosCadenaDpe, CostosDepositoSlot, CostosTxtLinea } from "./types";
import { COSTOS_DEPOSITOS, normalizeCadenaDpe } from "./types";

const MARCAS_ORDEN = Object.values(GRUPO_DIGITO_MARCA)
  .map((m) => m.label)
  .sort((a, b) => a.localeCompare(b, "es"));

export function slotFromDepositoKey(key: string): CostosDepositoSlot | null {
  const u = key.trim().toUpperCase();
  for (const d of COSTOS_DEPOSITOS) {
    if (d.keys.some((k) => u.includes(k.replace("S00_", "")) || u === k)) return d.slot;
  }
  if (u.includes("D1") || u === "S00_D1") return "D1";
  if (u.includes("DEP2") || u.includes("D2")) return "D2";
  if (u.includes("D3")) return "D3";
  if (u.includes("D4")) return "D4";
  return null;
}

export function parseCodigoPrefijo(codigo: string): {
  proveedorId: 654 | 638 | null;
  tipoV2Id: 1 | 2 | null;
} {
  const pref = codigo.trim().split(".")[0] ?? "";
  if (pref === "654") return { proveedorId: 654, tipoV2Id: 1 };
  if (pref === "638") return { proveedorId: 638, tipoV2Id: 2 };
  return { proveedorId: null, tipoV2Id: null };
}

/** @deprecated usar parseCodigoPrefijo + pilares desde detalle TXT */
export function parseCodigoPilares(codigo: string): {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  tipoV2Id: 1 | 2 | null;
} {
  const pref = parseCodigoPrefijo(codigo);
  return {
    linea: pref.proveedorId ? String(pref.proveedorId) : codigo.split(".")[0] ?? "",
    referencia: codigo.split(".")[1] ?? "0",
    material: "0",
    color: "0",
    tipoV2Id: pref.tipoV2Id,
  };
}

function includesWord(hay: string, needle: string): boolean {
  return normGrupoLabel(hay).includes(normGrupoLabel(needle));
}

/** Cabecera grupo TXT Carlos → DPE aproximado (siamese espíritu). */
export function dpeFromGrupoTexto(
  grupoTexto: string,
  tipoV2Id: 1 | 2 | null,
): Pick<CostosTxtLinea, "marca" | "ramo" | "tipo1" | "cadena"> {
  const g = normGrupoLabel(grupoTexto);
  let marca: string | null = null;
  for (const label of MARCAS_ORDEN) {
    if (includesWord(g, label)) {
      marca = label;
      break;
    }
  }

  const ramo: "CALZADOS" | "CONFECCIONES" | null =
    tipoV2Id === 2 || includesWord(g, "CONFECC")
      ? "CONFECCIONES"
      : tipoV2Id === 1 || includesWord(g, "CALZADO")
        ? "CALZADOS"
        : null;

  let tipo1: string | null = null;
  if (includesWord(g, "INVIERNO")) tipo1 = "INVIERNO";
  else if (includesWord(g, "VERANO")) tipo1 = "VERANO";
  else if (includesWord(g, "CERRADO")) tipo1 = "CERRADO";
  else if (includesWord(g, "ABIERTO")) tipo1 = "ABIERTO";
  else if (includesWord(g, "CARTERA")) tipo1 = "CARTERAS";
  else if (includesWord(g, "ACCESOR")) tipo1 = "ACCESORIOS";

  let cadenaRaw: string | null = "NORMAL";
  if (includesWord(g, "LIQUID") || includesWord(g, " LIQ")) cadenaRaw = "LIQUIDACION";
  else if (includesWord(g, "PROMO")) cadenaRaw = "PROMOCIONAL";
  else if (includesWord(g, "COMUN")) cadenaRaw = "COMUN";

  return { marca, ramo, tipo1, cadena: normalizeCadenaDpe(cadenaRaw) };
}

export function isGrupoBannerLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 4) return false;
  if (/^\d{3}\.\d+/.test(t)) return false;
  if (/^[\d\s.,\-+_]+$/.test(t)) return false;
  if (/COD\.|NUMERAC|ARTICULO|DEPOSITO:|MONEDA|STOCK|PROV:/i.test(t)) return false;
  const letters = (t.match(/[A-Za-zÁÉÍÓÚÑ]/g) ?? []).length;
  return letters >= 4 && letters / t.length > 0.35;
}

export function opcionesFiltroFromLineas(lineas: CostosTxtLinea[]): {
  marcas: string[];
  tipo1: string[];
  cadena: CostosCadenaDpe[];
} {
  const marcas = new Set<string>();
  const tipo1 = new Set<string>();
  const cadena = new Set<CostosCadenaDpe>();
  for (const l of lineas) {
    if (l.marca) marcas.add(l.marca);
    if (l.tipo1) tipo1.add(l.tipo1);
    if (l.cadena) cadena.add(l.cadena);
  }
  return {
    marcas: [...marcas].sort((a, b) => a.localeCompare(b, "es")),
    tipo1: [...tipo1].sort(),
    cadena: [...cadena].sort(),
  };
}
