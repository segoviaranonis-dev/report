import type { TipoV2Id } from "@/lib/pilares/types";
import { decodeCodGrupo, type CodGrupoDecoded } from "@/lib/pilares/cod-grupo-decode";

/**
 * Mapa canónico Excel SDRM / COD.GRUPO → pilares Report (Administrador L×R).
 *
 * Fuente de verdad: dígitos COD.GRUPO (10). Labels TIPO0/1/2 = control.
 * Estilo 638: ACTUAL / ANTERIOR (dígitos 07–08).
 */

export const SDRM_BATCH_DEFAULT = "sdrm0849";

export type SdrmRamo = "CALZADOS" | "CONFECCIONES";

/** Col F · Kyly 638 — género infantil (no caballeros/damas). */
export const SDRM_GENERO_TIPO0: Record<string, string> = {
  MASC: "NINOS",
  MASCULINO: "NINOS",
  FEM: "NINAS",
  FEMENINO: "NINAS",
};

export const SDRM_GENERO_TIPO2_CALZADO: Record<string, string> = {
  MASC: "CABALLEROS",
  FEM: "DAMAS",
};

/**
 * Ley Director 2026-08-17 · **2.3.5.16**
 * Toda línea **VIZZANO** es **DAMAS** (calzado, carteras, anteojos/lentes, medias…).
 * COD.GRUPO no aporta género en CARTERAS/LENTES → el mapa no debe dejar NULL.
 */
export const MARCA_VIZZANO_ID = 2;
export const MARCA_VIZZANO_GENERO_LEY = "DAMAS";

export function isMarcaVizzano(
  marcaId: number | null | undefined,
  marcaLabel?: string | null,
): boolean {
  if (marcaId === MARCA_VIZZANO_ID) return true;
  const n = normLabel(marcaLabel);
  return n === "VIZZANO" || n.startsWith("VIZZANO ");
}

/** Resuelve género pilares desde fila SDRM según ramo (fallback labels). */
export const SDRM_ESTILO_TIPO2_CALZADO: Record<string, string> = {
  BOTA: "BOTAS",
  NADA: "OTROS",
  LENTES: "OTROS",
};

/** @deprecated 638 usa ACTUAL/ANTERIOR desde COD.GRUPO — no CONFECCIONES. */
export const SDRM_ESTILO_FIJO_CONF = "CONFECCIONES";

export function ramoFromTipoV2(tipoV2Id: TipoV2Id): SdrmRamo {
  return tipoV2Id === 2 ? "CONFECCIONES" : "CALZADOS";
}

export function proveedorFromRamo(ramo: SdrmRamo): number {
  return ramo === "CONFECCIONES" ? 638 : 654;
}

export function normLabel(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Resuelve género pilares desde fila SDRM según ramo (fallback labels). */
export function generoCodigoFromSdrm(
  ramo: SdrmRamo,
  tipo0: string,
  tipo2: string,
): string | null {
  if (ramo === "CONFECCIONES") {
    const g = SDRM_GENERO_TIPO0[normLabel(tipo0)];
    return g ?? null;
  }
  const t2 = normLabel(tipo2);
  return SDRM_GENERO_TIPO2_CALZADO[t2] ?? null;
}

/** Estilo pilares desde Excel labels — preferir decodeCodGrupo. */
export function estiloLabelFromSdrm(ramo: SdrmRamo, _tipo0: string, tipo2: string): string | null {
  if (ramo === "CONFECCIONES") {
    const t = normLabel(tipo2);
    if (t === "ACTUAL" || t === "ANTERIOR") return t;
    return null;
  }
  const mapped = SDRM_ESTILO_TIPO2_CALZADO[normLabel(tipo2)];
  return mapped ?? null;
}

/** Tipo 1 pilares desde Excel labels — preferir decodeCodGrupo. */
export function tipo1LabelFromSdrm(ramo: SdrmRamo, tipo0: string, tipo1: string): string | null {
  if (ramo === "CONFECCIONES") {
    const t = normLabel(tipo1);
    if (t === "VERANO" || t === "INVIERNO") return t;
    return null;
  }
  const t0 = normLabel(tipo0);
  if (["ABIERTO", "CERRADO", "CARTERAS", "MEDIAS", "PRENDAS"].includes(t0)) return t0;
  return null;
}

/**
 * Emparejamiento canónico: COD.GRUPO gana; labels rellenan huecos.
 */
export function resolvePilaresFromCodGrupo(input: {
  cod_grupo: string | null | undefined;
  marca?: string | null;
  tipo0?: string | null;
  tipo1?: string | null;
  tipo2?: string | null;
  cadena?: string | null;
  ramoHint?: SdrmRamo;
}): {
  decoded: CodGrupoDecoded;
  genero_codigo: string | null;
  estilo_label: string | null;
  tipo1_label: string | null;
  marca_id: number | null;
  marca_label: string | null;
  cadena_comercial: string | null;
} {
  const decoded = decodeCodGrupo(input.cod_grupo, {
    marca: input.marca,
    tipo0: input.tipo0,
    tipo1: input.tipo1,
    tipo2: input.tipo2,
    cadena: input.cadena,
  });

  const ramo: SdrmRamo =
    decoded.ok ? decoded.ramo : input.ramoHint === "CONFECCIONES" ? "CONFECCIONES" : "CALZADOS";

  const marca_id = decoded.marcaId;
  const marca_label = decoded.marcaLabelEsperado ?? (input.marca ? normLabel(input.marca) : null);
  let genero_codigo =
    decoded.generoCodigo ??
    generoCodigoFromSdrm(ramo, input.tipo0 ?? "", input.tipo2 ?? "");
  // Ley 2.3.5.16 · VIZZANO = DAMAS siempre (carteras/anteojos sin dígito género).
  if (isMarcaVizzano(marca_id, marca_label ?? input.marca)) {
    genero_codigo = MARCA_VIZZANO_GENERO_LEY;
  }
  const estilo_label =
    decoded.estiloLabel ?? estiloLabelFromSdrm(ramo, input.tipo0 ?? "", input.tipo2 ?? "");
  const tipo1_label =
    decoded.tipo1Label ?? tipo1LabelFromSdrm(ramo, input.tipo0 ?? "", input.tipo1 ?? "");
  const cadena_comercial =
    decoded.cadenaComercial ??
    (input.cadena ? normLabel(input.cadena) : null) ??
    "REGULAR";

  return {
    decoded,
    genero_codigo,
    estilo_label,
    tipo1_label,
    marca_id,
    marca_label,
    cadena_comercial,
  };
}

export function mapaResumenPorProveedor(tipoV2Id: TipoV2Id) {
  if (tipoV2Id === 2) {
    return {
      titulo: "Kyly · Confecciones (638)",
      filas: [
        { excel: "COD.GRUPO d01–02", pilares: "Marca (linea.marca_id)" },
        { excel: "COD.GRUPO d03–04 FEM/MASC", pilares: "Género · FEM→NIÑAS · MASC→NIÑOS" },
        { excel: "COD.GRUPO d05–06 VER/INV", pilares: "AB-CR / tipo_1_id TEMPORADA" },
        { excel: "COD.GRUPO d07–08 ACTUAL/ANTERIOR", pilares: "Estilo (grupo_estilo_id)" },
        { excel: "COD.GRUPO d07–08 PROMO/LIQ", pilares: "Tipo · cadena_comercial / am_*" },
      ],
    };
  }
  return {
    titulo: "Beira Rio · Calzados (654)",
    filas: [
      { excel: "COD.GRUPO d01–02", pilares: "Marca (linea.marca_id)" },
      { excel: "COD.GRUPO d03–04 ABIERTO/CERRADO…", pilares: "AB-CR / tipo_1_id" },
      { excel: "COD.GRUPO d05–06 NORMAL/PROMO/LIQ", pilares: "Tipo · cadena_comercial" },
      { excel: "COD.GRUPO d07–08 BOTA/NADA…", pilares: "Estilo (grupo_estilo_id)" },
      { excel: "Labels TIPO0/1/2", pilares: "Control (dígito gana si conflicto)" },
      { excel: "Ley marca VIZZANO", pilares: "Género = DAMAS siempre (2.3.5.16 · carteras/anteojos)" },
    ],
  };
}

export { decodeCodGrupo, marcaIdFromCodGrupo, marcaKeyFromCodGrupo } from "@/lib/pilares/cod-grupo-decode";
