/**
 * Curva importadora canónica para grilla PE / Tránsito.
 * Formato: 34(1 2 3 3 2 1)39 — paridad linea-snapshot · RIMEC Web catalogo.
 */
import { gradasDisplayFromSnapshot } from "@/app/aprobaciones/lib/linea-snapshot-display";

export function gradaCurvaImportadora(
  grada: string | null | undefined,
  gradesJson: unknown,
): string {
  const raw = String(grada ?? "").trim();
  const display = gradasDisplayFromSnapshot({
    grada: raw && raw !== "—" ? raw : undefined,
    grades_json: gradesJson,
  });
  if (display) return display;
  if (raw && raw !== "—") return raw;
  return "—";
}
