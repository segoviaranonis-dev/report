import type { TipoV2Id } from "@/lib/pilares/types";

/**
 * Mapa canónico Excel SDRM → pilares Report (Administrador L×R).
 *
 * | Proveedor | Excel col     | Pilares                         | Alejandro Magno (PPD)      |
 * |-----------|---------------|---------------------------------|----------------------------|
 * | 638 Kyly  | F TIPO0       | genero_id · MASC→NIÑOS FEM→NIÑAS | am_* vía sync PPD       |
 * | 638 Kyly  | G TIPO1       | tipo_1_id · TEMPORADA VER/INV   | am_temporada               |
 * | 638 Kyly  | H TIPO2       | cadena_comercial LIQUIDACIÓN    | am_es_liquidacion          |
 * | 654 Beira | G TIPO1       | cadena_comercial LIQUIDACIÓN    | am_es_liquidacion          |
 * | 654 Beira | TIPO0/TIPO2   | tipo_1 / estilo / género calzado | (mapa calzado pendiente)  |
 *
 * Estilo 638: pendiente Director. LIQUIDACIÓN: report/docs/MAPA_SDRM_ALEJANDRO_MAGNO_LIQUIDACION.md
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

/** TIPO2 calzado → grupo_estilo_v2 (solo valores estructurales). */
export const SDRM_ESTILO_TIPO2_CALZADO: Record<string, string> = {
  BOTA: "BOTAS",
  NADA: "OTROS",
  LENTES: "OTROS",
};

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

/** Resuelve género pilares desde fila SDRM según ramo. */
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

/** Estilo pilares desde Excel — null = no tocar estilo en lr. */
export function estiloLabelFromSdrm(ramo: SdrmRamo, _tipo0: string, tipo2: string): string | null {
  if (ramo === "CONFECCIONES") return null;
  const mapped = SDRM_ESTILO_TIPO2_CALZADO[normLabel(tipo2)];
  return mapped ?? null;
}

/** Tipo 1 pilares desde Excel. */
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

export function mapaResumenPorProveedor(tipoV2Id: TipoV2Id) {
  if (tipoV2Id === 2) {
    return {
      titulo: "Kyly · Confecciones (638)",
      filas: [
        { excel: "Col F · TIPO0 MASC/FEM", pilares: "Género · MASC→NIÑOS · FEM→NIÑAS" },
        { excel: "Col G · TIPO1 VER/INV", pilares: "TEMPORADA → tipo_1_id (lr)" },
        { excel: "Estilo", pilares: "Pendiente Director" },
        { excel: "Col H · TIPO2 LIQUIDACIÓN", pilares: "am_es_liquidacion · PPD Alejandro Magno" },
        { excel: "MARCA", pilares: "Marca (linea.marca_id)" },
      ],
    };
  }
  return {
    titulo: "Beira Rio · Calzados (654)",
    filas: [
      { excel: "TIPO0 (ABIERTO/CERRADO…)", pilares: "Tipo 1 (linea_referencia.tipo_1_id)" },
      { excel: "TIPO2 (BOTA/NADA…)", pilares: "Estilo (linea_referencia.grupo_estilo_id)" },
      { excel: "TIPO2 FEM/MASC", pilares: "Género (linea.genero_id)" },
      { excel: "TIPO1 (LIQUIDACIÓN…)", pilares: "cadena_comercial SDRM · filtros PE/Web" },
      { excel: "MARCA", pilares: "Marca (linea.marca_id)" },
    ],
  };
}
