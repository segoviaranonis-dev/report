/** tipo_v2 (catálogo) → proveedor_importacion.id en pilares */
export const TIPO_V2_LABELS: Record<1 | 2, string> = {
  1: "Calzados (Beira Rio · 654)",
  2: "Confecciones (Kyly · 638)",
};

export function proveedorIdFromTipoV2(tipoV2Id: number): number | null {
  if (tipoV2Id === 1) return 654;
  if (tipoV2Id === 2) return 638;
  return null;
}

export function parseTipoV2Id(raw: string | null | undefined): 1 | 2 {
  const n = Number(raw);
  return n === 2 ? 2 : 1;
}
