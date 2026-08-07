/**
 * Auditoría tier LP/LPC — CSV PE Carlos.
 * Violación NIVEL DIOS · RENTABILIDAD 4.00.02.009 — no es un error operativo más.
 */
import { listaPrecioLabel, precioNetoCascada } from "@/app/aprobaciones/lib/aprobaciones-utils";
import {
  ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS,
  ERROR_CSV_PE_TIER_ALIAS_REPORT,
  PeCsvRentabilidadDiosError,
} from "@/lib/facturacion/csv-pe-rentabilidad-error";
import { fiListaTier } from "@/lib/pedido-proveedor/aritmetica-programado";
import type { ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import type { PeVentasCsvRow } from "@/lib/facturacion/csv-pe-ventas-export";

/** Código Moria canónico — rentabilidad holding. */
export const ERROR_CSV_PE_TIER_IMPERDONABLE = ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS;
export { ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS, ERROR_CSV_PE_TIER_ALIAS_REPORT, PeCsvRentabilidadDiosError };

export type PeCsvFiDetAudit = {
  fid_id: number;
  descuento_1: string | null;
  descuento_2: string | null;
  descuento_3: string | null;
  descuento_4: string | null;
  precio_unit: string | null;
  precio_neto: string | null;
  precio_base_snap: string | null;
  ppd_precio_lpn: string | null;
  ppd_precio_lpc02: string | null;
  ppd_precio_lpc03: string | null;
  ppd_precio_lpc04: string | null;
  codigo_barras: string | null;
};

export type PeCsvTierViolation = {
  code: typeof ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS;
  fid_id: number;
  codigo_articulo: string;
  lista_label: string;
  lista_tier: ListadoPrecioTierId;
  bruto_csv: number;
  neto_csv: number;
  bruto_esperado: number;
  bruto_lpn: number;
  motivo: string;
};

function num(raw: string | null | undefined): number {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function brutoTierPpd(r: PeCsvFiDetAudit, tier: ListadoPrecioTierId): number {
  const byTier: Record<ListadoPrecioTierId, number> = {
    1: num(r.ppd_precio_lpn),
    2: num(r.ppd_precio_lpc02),
    3: num(r.ppd_precio_lpc03),
    4: num(r.ppd_precio_lpc04),
  };
  const direct = byTier[tier];
  if (direct > 0) return direct;
  return num(r.ppd_precio_lpn);
}

/** Bruto canónico que debe salir al CSV para esta línea y tier. */
export function brutoEsperadoPeCsvTier(r: PeCsvFiDetAudit, listaPrecioId: number): number {
  const tier = fiListaTier(listaPrecioId);
  const unit = num(r.precio_unit);
  if (unit > 0) return unit;
  const tierPpd = brutoTierPpd(r, tier);
  if (tierPpd > 0) return tierPpd;
  return num(r.precio_base_snap);
}

function netoEsperadoPeCsv(r: PeCsvFiDetAudit, bruto: number): number {
  const netoBd = num(r.precio_neto);
  if (netoBd > 0) return netoBd;
  const d1 = num(r.descuento_1);
  const d2 = num(r.descuento_2);
  const d3 = num(r.descuento_3);
  const d4 = num(r.descuento_4);
  if (d1 + d2 + d3 + d4 > 0 && bruto > 0) {
    return precioNetoCascada(bruto, d1, d2, d3, d4);
  }
  return bruto;
}

/** ±1 Gs tolerancia redondeo. */
function preciosCoinciden(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(Math.round(a) - Math.round(b)) <= 1;
}

/**
 * Audita cada línea del CSV PE contra lista_precio_id de cabecera FI.
 * Retorna violaciones — array vacío = OK.
 */
export function auditPeCsvTierIntegrity(
  detRows: PeCsvFiDetAudit[],
  csvRows: PeVentasCsvRow[],
  listaPrecioId: number,
): PeCsvTierViolation[] {
  const tier = fiListaTier(listaPrecioId);
  const listaLabel = listaPrecioLabel(listaPrecioId);
  const byFid = new Map(csvRows.map((r) => [r.fid_id, r]));
  const out: PeCsvTierViolation[] = [];

  for (const det of detRows) {
    const csv = byFid.get(det.fid_id);
    if (!csv) continue;

    const brutoCsv = num(csv.precio_sin_descuento);
    const netoCsv = num(csv.precio_con_descuento);
    const brutoEsp = brutoEsperadoPeCsvTier(det, listaPrecioId);
    const brutoLpn = brutoTierPpd(det, 1);
    const netoEsp = netoEsperadoPeCsv(det, brutoEsp);
    const codigo = String(csv.codigo_articulo ?? det.codigo_barras ?? "").trim() || `fid=${det.fid_id}`;

    if (brutoEsp <= 0) {
      out.push({
        code: ERROR_CSV_PE_TIER_IMPERDONABLE,
        fid_id: det.fid_id,
        codigo_articulo: codigo,
        lista_label: listaLabel,
        lista_tier: tier,
        bruto_csv: brutoCsv,
        neto_csv: netoCsv,
        bruto_esperado: brutoEsp,
        bruto_lpn: brutoLpn,
        motivo: "Sin precio canónico para el tier de cabecera — no exportar.",
      });
      continue;
    }

    if (!preciosCoinciden(brutoCsv, brutoEsp)) {
      const pareceLpn =
        tier !== 1 &&
        brutoLpn > 0 &&
        brutoTierPpd(det, tier) > 0 &&
        brutoTierPpd(det, tier) !== brutoLpn &&
        preciosCoinciden(brutoCsv, brutoLpn);

      out.push({
        code: ERROR_CSV_PE_TIER_IMPERDONABLE,
        fid_id: det.fid_id,
        codigo_articulo: codigo,
        lista_label: listaLabel,
        lista_tier: tier,
        bruto_csv: brutoCsv,
        neto_csv: netoCsv,
        bruto_esperado: brutoEsp,
        bruto_lpn: brutoLpn,
        motivo: pareceLpn
          ? `RENTABILIDAD: CSV lleva LPN (${brutoCsv}) con cabecera ${listaLabel} — Nivel Dios.`
          : `RENTABILIDAD: bruto CSV (${brutoCsv}) ≠ ${listaLabel} (${brutoEsp}).`,
      });
      continue;
    }

    if (netoCsv > 0 && netoEsp > 0 && !preciosCoinciden(netoCsv, netoEsp)) {
      out.push({
        code: ERROR_CSV_PE_TIER_IMPERDONABLE,
        fid_id: det.fid_id,
        codigo_articulo: codigo,
        lista_label: listaLabel,
        lista_tier: tier,
        bruto_csv: brutoCsv,
        neto_csv: netoCsv,
        bruto_esperado: brutoEsp,
        bruto_lpn: brutoLpn,
        motivo: `Neto CSV (${netoCsv}) ≠ neto esperado (${netoEsp}) para ${listaLabel}.`,
      });
    }
  }

  return out;
}

export function formatPeCsvTierViolation(v: PeCsvTierViolation): string {
  return `[${v.code}] fid=${v.fid_id} · ${v.codigo_articulo} · ${v.motivo}`;
}

export function assertPeCsvTierOrThrow(
  violations: PeCsvTierViolation[],
  ctx: { fiId: number; nroFactura?: string },
): void {
  if (!violations.length) return;
  console.error(
    "[NIVEL_DIOS_RENTABILIDAD]",
    ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS,
    ctx.nroFactura ?? ctx.fiId,
    violations.length,
    "líneas",
  );
  throw new PeCsvRentabilidadDiosError({
    fiId: ctx.fiId,
    nroFactura: ctx.nroFactura,
    violations,
  });
}
