"use client";

import { EXCEL_AL_0308 } from "@/lib/situacion-financiera/excel-al-0308";
import type { ExcelAlRow } from "@/lib/situacion-financiera/types";

/** Misma data Excel AL, presentación Guido HTML v2 (mescol + Times + grilla). */

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function mesLabel(mes: string | null | undefined): string {
  if (!mes) return "";
  const [y, m] = mes.split("-");
  const n = [
    "",
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${n[Number(m)] || m}-${(y || "").slice(2)}`;
}

function bg(row: ExcelAlRow): string {
  if (row.kind === "total_yellow") return "#FFFF00";
  if (row.kind === "total_green" || row.kind === "reserva") return "#E2EFDA";
  if (row.kind === "total_gray") return "#BFBFBF";
  if (row.kind === "section" || row.kind === "subheader") return "#BDD7EE";
  if (row.kind === "tasa") return "#DDEBF7";
  if (row.kind === "prevision") return "#D9D9D9";
  return "#FFFFFF";
}

export function GuidoHtmlExcelLookTab() {
  const rows = EXCEL_AL_0308.rows.filter((r) => r.kind !== "spacer");

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-600">
        Versión Guido <strong>HTML v2 · look Excel/PDF</strong> (CONTEXTO:
        REDISEÑO TAL CUAL EL EXCEL). Fuente Times, grilla completa, saldo
        amarillo <code className="rounded bg-slate-100 px-1">#FFFF00</code>,
        reserva verde. Datos = snapshot SF AL 03-08.
      </p>
      <div className="overflow-x-auto border border-black bg-white">
        <table
          className="w-full min-w-[700px] border-collapse text-[11px]"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <tbody>
            {rows.map((row) => {
              const isHead =
                row.kind === "section" || row.kind === "subheader";
              return (
                <tr key={row.r} style={{ background: bg(row) }}>
                  <td
                    className="border border-black px-1 py-0.5 w-16 text-center font-semibold"
                    style={{
                      background: row.mes ? "#FFF2CC" : "transparent",
                    }}
                  >
                    {mesLabel(row.mes)}
                  </td>
                  <td
                    className={`border border-black px-1.5 py-0.5 ${
                      row.bold || isHead ? "font-bold" : ""
                    }`}
                  >
                    {row.label}
                  </td>
                  <td
                    className={`border border-black px-1.5 py-0.5 text-right tabular-nums ${
                      (row.gs ?? 0) < 0 ? "text-[#C00000]" : ""
                    }`}
                  >
                    {row.kind === "tasa" ? fmtUsd(row.gs) : fmtGs(row.gs)}
                  </td>
                  <td
                    className={`border border-black px-1.5 py-0.5 text-right tabular-nums ${
                      (row.usd ?? 0) < 0 ? "text-[#C00000]" : ""
                    }`}
                  >
                    {row.kind === "tasa" ? "" : fmtUsd(row.usd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
