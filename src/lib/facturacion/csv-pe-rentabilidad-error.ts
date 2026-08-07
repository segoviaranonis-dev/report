/**
 * Violación rentabilidad · Nivel Dios — CSV PE tier incorrecto.
 * NO es un error operativo más: impacto directo en margen / facturación Carlos.
 */
import type { PeCsvTierViolation } from "@/lib/facturacion/csv-pe-tier-audit";

/** Código Moria canónico — clase 4.00 · Rentabilidad holding (4.00.02.009). */
export const ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS = "4.00.02.009";

/** Alias histórico Report (subcuenta facturación) — mismo incidente. */
export const ERROR_CSV_PE_TIER_ALIAS_REPORT = "4.02.04.005";

export const SEVERITY_NIVEL_DIOS_RENTABILIDAD = "NIVEL_DIOS_RENTABILIDAD" as const;

export class PeCsvRentabilidadDiosError extends Error {
  readonly code = ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS;
  readonly aliasCode = ERROR_CSV_PE_TIER_ALIAS_REPORT;
  readonly severity = SEVERITY_NIVEL_DIOS_RENTABILIDAD;
  readonly fiId: number;
  readonly nroFactura?: string;
  readonly violations: PeCsvTierViolation[];

  constructor(ctx: {
    fiId: number;
    nroFactura?: string;
    violations: PeCsvTierViolation[];
  }) {
    const n = ctx.violations.length;
    const head = ctx.violations
      .slice(0, 2)
      .map((v) => `${v.codigo_articulo}: ${v.motivo}`)
      .join(" · ");
    super(
      `NIVEL DIOS · RENTABILIDAD · CSV PE bloqueado (${ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS}). ` +
        `FI ${ctx.nroFactura ?? ctx.fiId} · ${n} línea(s) con tier LP incorrecto. ${head}`,
    );
    this.name = "PeCsvRentabilidadDiosError";
    this.fiId = ctx.fiId;
    this.nroFactura = ctx.nroFactura;
    this.violations = ctx.violations;
  }

  toApiBody() {
    return {
      error: this.message,
      code: this.code,
      aliasCode: this.aliasCode,
      severity: this.severity,
      title: "Violación rentabilidad · Nivel Dios",
      impacto:
        "Exportar precio LPN con lista LPC03/LPC02/LPC04 destruye margen en Carlos. Prohibido exportar.",
      fiId: this.fiId,
      nroFactura: this.nroFactura ?? null,
      violationCount: this.violations.length,
      violations: this.violations.slice(0, 5).map((v) => ({
        fid_id: v.fid_id,
        codigo_articulo: v.codigo_articulo,
        lista: v.lista_label,
        motivo: v.motivo,
        bruto_csv: v.bruto_csv,
        bruto_esperado: v.bruto_esperado,
        bruto_lpn: v.bruto_lpn,
      })),
    };
  }
}

export function isPeCsvRentabilidadDiosError(err: unknown): err is PeCsvRentabilidadDiosError {
  return err instanceof PeCsvRentabilidadDiosError;
}

/** Mensaje UI — bandeja / bóveda. */
export function mensajeUiRentabilidadDios(data: {
  error?: string;
  title?: string;
  impacto?: string;
  code?: string;
}): string {
  const parts = [
    data.title ?? "NIVEL DIOS · RENTABILIDAD",
    data.impacto ??
      "Este CSV habría facturado al precio equivocado. Contactá al Director — no reintentar a ciegas.",
    data.code ? `Código ${data.code}` : "",
    data.error ?? "",
  ].filter(Boolean);
  return parts.join("\n\n");
}
