"use client";

import { EXCEL_AL_0308 } from "@/lib/situacion-financiera/excel-al-0308";
import type { ExcelAlRow } from "@/lib/situacion-financiera/types";

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
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
  const nombres = [
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
  const mi = Number(m);
  return `${nombres[mi] || m}-${y?.slice(2) || ""}`;
}

function rowClass(row: ExcelAlRow): string {
  switch (row.kind) {
    case "total_yellow":
      return "bg-[#FFFF00] font-bold";
    case "total_green":
      return "bg-[#C6EFCE] font-bold";
    case "total_gray":
      return "bg-[#D9D9D9] font-bold";
    case "section":
    case "subheader":
      return "bg-[#1F4E79] text-white font-bold";
    case "reserva":
      return "bg-[#FFF2CC] font-semibold";
    case "tasa":
      return "bg-[#DDEBF7] font-bold";
    case "prevision":
      return "bg-[#F2F2F2] font-semibold";
    default:
      return row.bold ? "font-semibold" : "";
  }
}

export function SitFinExcelAlTab() {
  const snap = EXCEL_AL_0308;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-600">
        Réplica visual de la hoja <strong>SIT FIN</strong> del Excel{" "}
        <code className="rounded bg-slate-100 px-1">{snap.titulo}.xlsx</code> ·
        corte AL {snap.fechaAl.split("-").reverse().join("/")} · datos fijos del
        archivo (no recalcula pipeline).
      </p>

      <div className="overflow-x-auto rounded border border-slate-400 bg-white shadow-sm">
        <table
          className="w-full min-w-[720px] border-collapse text-[12px] leading-tight"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <thead>
            <tr className="bg-[#1F4E79] text-white">
              <th className="border border-slate-500 px-2 py-1.5 text-left w-20">
                Mes
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Concepto
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-right w-40">
                Importe Gs
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-right w-36">
                USD
              </th>
            </tr>
          </thead>
          <tbody>
            {snap.rows.map((row) => {
              if (row.kind === "spacer") {
                return (
                  <tr key={`sp-${row.r}`} className="h-2">
                    <td
                      colSpan={4}
                      className="border border-slate-200 bg-white"
                    />
                  </tr>
                );
              }
              const cls = rowClass(row);
              const isHeader =
                row.kind === "section" || row.kind === "subheader";
              return (
                <tr key={row.r} className={cls}>
                  <td className="border border-slate-400 px-2 py-0.5 whitespace-nowrap">
                    {mesLabel(row.mes)}
                  </td>
                  <td
                    className={`border border-slate-400 px-2 py-0.5 ${
                      isHeader ? "uppercase tracking-wide" : ""
                    }`}
                  >
                    {row.label || (isHeader ? "SALDOS" : "")}
                  </td>
                  <td
                    className={`border border-slate-400 px-2 py-0.5 text-right tabular-nums ${
                      (row.gs ?? 0) < 0 ? "text-red-700" : ""
                    }`}
                  >
                    {row.kind === "tasa"
                      ? fmtUsd(row.gs)
                      : row.kind === "prevision"
                        ? ""
                        : fmtGs(row.gs)}
                  </td>
                  <td
                    className={`border border-slate-400 px-2 py-0.5 text-right tabular-nums ${
                      (row.usd ?? 0) < 0 ? "text-red-700" : ""
                    }`}
                  >
                    {row.kind === "tasa" || row.kind === "prevision"
                      ? ""
                      : fmtUsd(row.usd)}
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
