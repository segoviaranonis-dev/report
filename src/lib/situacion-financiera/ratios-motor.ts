/**
 * Ola 4 — Motor de ratios (puro). Sin UI. Sin inventar cifras.
 * ROA/ROE/CCC solo si hay insumos con linaje; si no → bloqueado.
 */

export type RatioId = "razon_caja" | "dso" | "ccc" | "roa" | "roe";

export type RatioInput = {
  cajaBancosGs?: number | null;
  pasivoCorrienteGs?: number | null;
  cxcGs?: number | null;
  ventasPeriodoGs?: number | null;
  inventarioGs?: number | null;
  cmvGs?: number | null;
  cxpGs?: number | null;
  comprasPeriodoGs?: number | null;
  utilidadGs?: number | null;
  activosGs?: number | null;
  patrimonioGs?: number | null;
  diasPeriodo?: number;
};

export type RatioResultado = {
  id: RatioId;
  label: string;
  formula: string;
  valor: number | null;
  unidad: string;
  estado: "ok" | "bloqueado";
  motivoBloqueo?: string;
  ola: 1 | 4;
};

function num(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

/** Razón de caja = (caja+bancos) / pasivo corriente — liquidez Ola 1. */
export function razonCaja(i: RatioInput): RatioResultado {
  const base = {
    id: "razon_caja" as const,
    label: "Razón de caja",
    formula: "(Caja+Bancos) / Pasivo corriente",
    unidad: "x",
    ola: 1 as const,
  };
  if (!num(i.cajaBancosGs) || !num(i.pasivoCorrienteGs) || i.pasivoCorrienteGs === 0) {
    return {
      ...base,
      valor: null,
      estado: "bloqueado",
      motivoBloqueo: "Faltan caja/bancos o pasivo corriente con linaje",
    };
  }
  return {
    ...base,
    valor: i.cajaBancosGs / i.pasivoCorrienteGs,
    estado: "ok",
  };
}

/** DSO = (CxC / Ventas) × días */
export function dso(i: RatioInput): RatioResultado {
  const dias = i.diasPeriodo ?? 30;
  const base = {
    id: "dso" as const,
    label: "DSO (días cobro)",
    formula: "(CxC / Ventas período) × días",
    unidad: "días",
    ola: 4 as const,
  };
  if (!num(i.cxcGs) || !num(i.ventasPeriodoGs) || i.ventasPeriodoGs === 0) {
    return {
      ...base,
      valor: null,
      estado: "bloqueado",
      motivoBloqueo: "Faltan CxC o ventas del período (no usar cheques como proxy)",
    };
  }
  return {
    ...base,
    valor: (i.cxcGs / i.ventasPeriodoGs) * dias,
    estado: "ok",
  };
}

/** CCC = DIO + DSO − DPO */
export function ccc(i: RatioInput): RatioResultado {
  const dias = i.diasPeriodo ?? 30;
  const base = {
    id: "ccc" as const,
    label: "CCC (ciclo conversión efectivo)",
    formula: "DIO + DSO − DPO",
    unidad: "días",
    ola: 4 as const,
  };
  if (
    !num(i.inventarioGs) ||
    !num(i.cmvGs) ||
    i.cmvGs === 0 ||
    !num(i.cxcGs) ||
    !num(i.ventasPeriodoGs) ||
    i.ventasPeriodoGs === 0 ||
    !num(i.cxpGs) ||
    !num(i.comprasPeriodoGs) ||
    i.comprasPeriodoGs === 0
  ) {
    return {
      ...base,
      valor: null,
      estado: "bloqueado",
      motivoBloqueo:
        "Faltan inventario/CMV/CxC/ventas/CxP/compras — Ola 4; no inventar desde Sit Fin Excel",
    };
  }
  const dio = (i.inventarioGs / i.cmvGs) * dias;
  const dsoV = (i.cxcGs / i.ventasPeriodoGs) * dias;
  const dpo = (i.cxpGs / i.comprasPeriodoGs) * dias;
  return { ...base, valor: dio + dsoV - dpo, estado: "ok" };
}

/** ROA = utilidad / activos — NUNCA con cheques/aging solos */
export function roa(i: RatioInput): RatioResultado {
  const base = {
    id: "roa" as const,
    label: "ROA",
    formula: "Utilidad / Activos",
    unidad: "%",
    ola: 4 as const,
  };
  if (!num(i.utilidadGs) || !num(i.activosGs) || i.activosGs === 0) {
    return {
      ...base,
      valor: null,
      estado: "bloqueado",
      motivoBloqueo:
        "ROA requiere utilidad y activos con linaje — Sit Fin caja NO alcanza",
    };
  }
  return {
    ...base,
    valor: (i.utilidadGs / i.activosGs) * 100,
    estado: "ok",
  };
}

/** ROE = utilidad / patrimonio */
export function roe(i: RatioInput): RatioResultado {
  const base = {
    id: "roe" as const,
    label: "ROE",
    formula: "Utilidad / Patrimonio",
    unidad: "%",
    ola: 4 as const,
  };
  if (!num(i.utilidadGs) || !num(i.patrimonioGs) || i.patrimonioGs === 0) {
    return {
      ...base,
      valor: null,
      estado: "bloqueado",
      motivoBloqueo:
        "ROE requiere utilidad y patrimonio con linaje — no confundir con saldo disponible",
    };
  }
  return {
    ...base,
    valor: (i.utilidadGs / i.patrimonioGs) * 100,
    estado: "ok",
  };
}

export function calcularRatios(i: RatioInput): RatioResultado[] {
  return [razonCaja(i), dso(i), ccc(i), roa(i), roe(i)];
}
