/** Metadatos de negocio por proveedor — biblioteca, listado y cálculo son distintos. */
export type MotorProveedorMeta = {
  id: number;
  codigo: string;
  label: string;
  tipoV2Id: 1 | 2;
  tipoLabel: string;
  biblioteca: string;
  listado: string;
  calculo: string;
  /** Paso 0 Report habilitado (parser + reglas en TS). */
  paso0Report: boolean;
};

export const MOTOR_PROVEEDORES_META: Record<654 | 638, MotorProveedorMeta> = {
  654: {
    id: 654,
    codigo: "654",
    label: "Beira Rio · Calzados",
    tipoV2Id: 1,
    tipoLabel: "Calzados",
    biblioteca: "Biblioteca canónica 1905 · casos L+R por STYLE · material numérico",
    listado: "Excel hojas = marca · columnas A–E (STYLE, REF, MAT, DESC, FOB) · ley género calzado",
    calculo: "Caso biblioteca + descuentos LPN/LPC sobre FOB fábrica · ROUND en Postgres",
    paso0Report: true,
  },
  638: {
    id: 638,
    codigo: "638",
    label: "Kyly · Confecciones",
    tipoV2Id: 2,
    tipoLabel: "Confecciones",
    biblioteca: "Biblioteca propia 638 · L alfanumérico · referencia sintética K · material {linea}K",
    listado: "Layout Excel distinto al calzado — no mezclar archivos Beira Rio",
    calculo: "Reglas de caso y márgenes distintas al 654 — motor separado por proveedor_id",
    paso0Report: false,
  },
};

export const MOTOR_PROVEEDOR_IDS = [654, 638] as const;

export type MotorProveedorId = (typeof MOTOR_PROVEEDOR_IDS)[number];

export function getMotorProveedorMeta(id: number): MotorProveedorMeta | null {
  if (id === 654) return MOTOR_PROVEEDORES_META[654];
  if (id === 638) return MOTOR_PROVEEDORES_META[638];
  return null;
}

export function mergeProveedoresDb(
  rows: { id: number; codigo: string; nombre: string }[],
): Array<{ id: number; codigo: string; nombre: string; meta: MotorProveedorMeta | null; enBd: true }> {
  return rows
    .map((r) => ({
      ...r,
      meta: getMotorProveedorMeta(r.id),
      enBd: true as const,
    }))
    .sort((a, b) => a.id - b.id);
}
