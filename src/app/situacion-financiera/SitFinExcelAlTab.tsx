"use client";

import { Fragment, useMemo, useState } from "react";
import { EXCEL_AL_0308 } from "@/lib/situacion-financiera/excel-al-0308";
import {
  inferMesContext,
  molKeyForExcelRow,
  origenRespaldo,
  type SfRespaldoOrigen,
} from "@/lib/situacion-financiera/mol-key";
import type { ExcelAlRow, MolNode } from "@/lib/situacion-financiera/types";
import { MolAccordionPanel } from "./MolAccordion";

/** Verde Guido = TXT · naranja = manual · lila = pendiente · amarillo = calc */
const RESPALDO_BG: Record<SfRespaldoOrigen, string> = {
  txt: "bg-[#C6EFCE]",
  manual: "bg-[#FCE4D6]",
  pendiente: "bg-[#E2D5F1]",
  calc: "bg-[#FFFF00]",
};

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

function rowClass(
  row: ExcelAlRow,
  origen: SfRespaldoOrigen | null
): string {
  switch (row.kind) {
    case "total_yellow":
      return `${RESPALDO_BG.calc} font-bold`;
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
    default: {
      const base = origen ? RESPALDO_BG[origen] : "";
      return `${base} ${row.bold ? "font-semibold" : ""}`.trim();
    }
  }
}

function buildDisponibleFallback(
  rows: ExcelAlRow[],
  mesYm: string
): MolNode {
  // Filas del bloque hasta el SALDO DISPONIBLE de ese mes
  const children: MolNode[] = [];
  let mes: string | null = mesYm === "2026-08" ? "2026-08" : null;
  let collecting = mesYm === "2026-08";

  for (const row of rows) {
    if (row.mes) {
      mes = row.mes;
      collecting = mes === mesYm;
    }
    if (!collecting) continue;
    if (row.kind === "total_yellow") {
      const label = (row.label || "").toUpperCase();
      if (label.includes("SALDO DISPONIBLE")) break;
    }
    if (row.kind !== "row") continue;
    if (row.gs == null && row.usd == null) continue;
    children.push({
      id: `disp-${mesYm}-${row.r}`,
      label: row.label || `fila ${row.r}`,
      gs: row.gs,
      usd: row.usd,
      meta: "composición del mes (Excel)",
    });
  }
  return {
    id: `disponible-${mesYm}`,
    label: `Saldo disponible ${mesYm}`,
    fuente: "Suma conceptual filas del bloque Excel",
    meta: `${children.length} líneas del mes`,
    children,
  };
}

type Annotated = {
  row: ExcelAlRow;
  mesCtx: string | null;
  molKey: string | null;
};

export function SitFinExcelAlTab() {
  const snap = EXCEL_AL_0308;
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const annotated = useMemo(() => {
    let mesCtx: string | null = null;
    const out: Annotated[] = [];
    for (const row of snap.rows) {
      mesCtx = inferMesContext(row, mesCtx);
      // primer bloque sin mescol = agosto
      if (!mesCtx && row.kind === "row") mesCtx = "2026-08";
      const molKey = molKeyForExcelRow(row, mesCtx);
      out.push({ row, mesCtx, molKey });
    }
    return out;
  }, [snap.rows]);

  function toggle(key: string) {
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-600">
        Réplica <strong>SIT FIN</strong> ·{" "}
        <code className="rounded bg-slate-100 px-1">{snap.titulo}.xlsx</code> ·
        AL {snap.fechaAl.split("-").reverse().join("/")}. Filas con{" "}
        <span className="font-semibold text-sky-800">▸</span>: cada Gs
        rastreable baja hasta la <strong>línea limpia del TXT</strong>.
      </p>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded border border-emerald-400 bg-[#C6EFCE] px-2 py-0.5">
          Verde · respaldo TXT limpio
        </span>
        <span className="rounded border border-orange-400 bg-[#FCE4D6] px-2 py-0.5">
          Naranja · carga manual (Excel)
        </span>
        <span className="rounded border border-violet-400 bg-[#E2D5F1] px-2 py-0.5">
          Lila · pendiente (cuadro Guido)
        </span>
        <span className="rounded border border-amber-400 bg-[#FFFF00] px-2 py-0.5">
          Amarillo · calculado (saldo disponible)
        </span>
      </div>

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
            {annotated.map(({ row, molKey, mesCtx }) => {
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
              const origen = origenRespaldo(molKey);
              const cls = rowClass(row, origen);
              const isHeader =
                row.kind === "section" || row.kind === "subheader";
              const trackable = !!molKey;
              const open = molKey ? !!openKeys[`${row.r}:${molKey}`] : false;
              const rowOpenKey = molKey ? `${row.r}:${molKey}` : "";
              const disponFallback = molKey?.startsWith("disponible:")
                ? buildDisponibleFallback(
                    snap.rows,
                    molKey.slice("disponible:".length)
                  )
                : molKey
                  ? ({
                      id: `row-${row.r}`,
                      label: row.label || `fila ${row.r}`,
                      gs: row.gs,
                      usd: row.usd,
                      meta: `mes ctx ${mesCtx || "—"} · fallback fila Excel`,
                      fuente: "Excel AL",
                      children: [
                        {
                          id: `row-${row.r}-leaf`,
                          label: "Importe de la fila (sin desglose staging)",
                          gs: row.gs,
                          usd: row.usd,
                        },
                      ],
                    } as MolNode)
                  : null;

              return (
                <Fragment key={row.r}>
                  <tr
                    className={`${cls} ${
                      trackable
                        ? "cursor-pointer hover:ring-1 hover:ring-sky-400/60"
                        : ""
                    }`}
                    onClick={() => trackable && molKey && toggle(rowOpenKey)}
                    title={
                      trackable
                        ? "Clic para ver composición molecular"
                        : undefined
                    }
                  >
                    <td className="border border-slate-400 px-2 py-0.5 whitespace-nowrap">
                      {mesLabel(row.mes)}
                    </td>
                    <td
                      className={`border border-slate-400 px-2 py-0.5 ${
                        isHeader ? "uppercase tracking-wide" : ""
                      }`}
                    >
                      {trackable ? (
                        <span className="mr-1 inline-block w-3 font-mono text-sky-700">
                          {open ? "▾" : "▸"}
                        </span>
                      ) : (
                        <span className="mr-1 inline-block w-3" />
                      )}
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
                  {open && molKey ? (
                    <tr>
                      <MolAccordionPanel
                        molKey={molKey}
                        fallback={disponFallback}
                      />
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
