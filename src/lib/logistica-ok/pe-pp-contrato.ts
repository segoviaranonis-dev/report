/**
 * Contrato PE ↔ Logística OK · Fecha de entrega Real (2.3.1.28 / 2.3.1.28.0)
 * Ancla: pedido_proveedor (universo PE) · verdad en fecha_arribo_real.
 */
import {
  PE_CATEGORIA_ID,
  PE_ENTIDAD_COMERCIAL,
  PE_ESTADO_TRANSITO,
  PE_QUINCENA_DESC,
} from "@/lib/stock-pronta-entrega/pe-ppd-sql";
import { FECHA_ENTREGA_REAL_LABEL } from "@/lib/logistica-ok/constants";

export {
  PE_CATEGORIA_ID,
  PE_ENTIDAD_COMERCIAL,
  PE_ESTADO_TRANSITO,
  PE_QUINCENA_DESC,
  FECHA_ENTREGA_REAL_LABEL,
};

/** WHERE canónico cabecera PP de pronta entrega (mismo pe-ppd-sql). */
export const SQL_PP_ES_PE = `
  pp.entidad_comercial = '${PE_ENTIDAD_COMERCIAL}'
  AND pp.deposito_codigo IS NOT NULL
  AND pp.estado_transito = '${PE_ESTADO_TRANSITO}'
  AND pp.categoria_id = ${PE_CATEGORIA_ID}
  AND lower(trim(qa.descripcion)) = lower('${PE_QUINCENA_DESC}')
`;

export function esNroFacturaPe(nro: string | null | undefined): boolean {
  return Boolean(nro && /^PE-/i.test(nro.trim()));
}

/** Rigor: FI PE operativa para logística exige pp_id + Fecha de entrega Real. */
export function rigorFiPeLogistica(input: {
  nro_factura?: string | null;
  pp_id?: number | null;
  fecha_arribo_real?: string | Date | null;
}): { ok: true } | { ok: false; error: string } {
  if (!esNroFacturaPe(input.nro_factura) && input.pp_id == null) {
    return { ok: false, error: "FI PE sin identificación PE (nro PE-% o pp_id)." };
  }
  if (input.pp_id == null || !Number.isFinite(Number(input.pp_id)) || Number(input.pp_id) <= 0) {
    return { ok: false, error: "FI PE sin pp_id real — no puede entrar a Logística OK." };
  }
  const f =
    input.fecha_arribo_real == null
      ? ""
      : typeof input.fecha_arribo_real === "string"
        ? input.fecha_arribo_real.slice(0, 10)
        : input.fecha_arribo_real.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    return {
      ok: false,
      error: `FI PE sin ${FECHA_ENTREGA_REAL_LABEL} en el PP — activá logística en Pedido proveedor.`,
    };
  }
  return { ok: true };
}

export function fmtFechaEntregaReal(v: string | Date | null | undefined): string {
  if (v == null) return "—";
  const d = (typeof v === "string" ? v : v.toISOString()).slice(0, 10);
  const [y, m, day] = d.split("-");
  if (y && m && day) return `${day}/${m}/${y}`;
  return d;
}
