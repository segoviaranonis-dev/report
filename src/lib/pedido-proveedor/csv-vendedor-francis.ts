/**
 * @deprecated Usar `@/lib/carlos/vendedor-carlos-resolver` (matriz Hoja2 completa).
 */
import { resolveCodigoVendedorReal } from "@/lib/carlos/vendedor-carlos-resolver";

export type FrancisTranslator = {
  nexusVendedorId: number;
  nombre: string;
  carlosByMatriz: Record<string, number>;
  defaultCarlosId: number;
};

const FRANCIS_TRANSLATOR: FrancisTranslator = {
  nexusVendedorId: 9,
  nombre: "FRANCIS",
  carlosByMatriz: {
    "ACT-BRSPORT": 29,
    CARTERAS: 29,
    PROMOCIONAL: 58,
    CHINELO: 58,
    "BR-VZ-MD-ML-MKA-O": 29,
  },
  defaultCarlosId: 29,
};

export function loadFrancisTranslator(): FrancisTranslator {
  return FRANCIS_TRANSLATOR;
}

/** @deprecated */
export function carlosVendedorIdFrancis(
  casoNombre: string | null | undefined,
  translator: FrancisTranslator = FRANCIS_TRANSLATOR,
): number {
  const cod = resolveCodigoVendedorReal({ vendedor_nombre: "FRANCIS", caso: casoNombre });
  if (cod) return Number(cod);
  return translator.defaultCarlosId;
}
