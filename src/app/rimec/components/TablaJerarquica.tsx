"use client";

import { useMemo, useState } from "react";
import type { FullSnapshotJerarquiaLeaf } from "@/lib/rimec/full-snapshot-types";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type NodoJerarquia = {
  tipo: "cadena" | "cliente" | "marca";
  nombre: string;
  nivel: number;
  montoObj: number;
  monto26: number;
  variacionPct: number | null;
  count: number;
  hijos?: NodoJerarquia[];
  path: string;
  /** Presente en cliente y marca para estilos por segmento (cartera). */
  idCliente?: number;
};

export type SegmentoCarteraCliente = "crecimiento" | "riesgo" | "sin_compra";

function claseSombraSegmento(segmento: SegmentoCarteraCliente): string {
  switch (segmento) {
    case "crecimiento":
      return "shadow-[0_0_16px_-5px_rgba(34,197,94,0.42)] border-l-2 border-l-emerald-400/65";
    case "riesgo":
      return "shadow-[0_0_16px_-5px_rgba(249,115,22,0.38)] border-l-2 border-l-orange-400/60";
    case "sin_compra":
      return "shadow-[0_0_16px_-5px_rgba(248,113,113,0.35)] border-l-2 border-l-red-400/55";
    default:
      return "";
  }
}

/**
 * Árbol Cadena → Cliente → Marca a partir de hojas ya agregadas en Postgres (ids + descripciones FK).
 * Los subtotales se arman sumando montos de hijos; la variación % se recalcula vs objetivo agregado.
 */
export function construirJerarquiaDesdeHojas(
  leaves: FullSnapshotJerarquiaLeaf[],
  filterClienteIds?: Set<number> | null
): NodoJerarquia[] {
  const filtradas =
    filterClienteIds === undefined || filterClienteIds === null
      ? leaves
      : filterClienteIds.size === 0
        ? []
        : leaves.filter((L) => filterClienteIds.has(L.id_cliente));

  const byCadena = new Map<number, { desc: string; leaves: FullSnapshotJerarquiaLeaf[] }>();
  for (const L of filtradas) {
    const cur = byCadena.get(L.id_cadena) ?? { desc: L.descp_cadena, leaves: [] };
    cur.desc = L.descp_cadena;
    cur.leaves.push(L);
    byCadena.set(L.id_cadena, cur);
  }

  const jerarquia: NodoJerarquia[] = [];

  for (const [idCadena, bucketCad] of byCadena) {
    const leavesCad = bucketCad.leaves;
    const displayCadena = bucketCad.desc || "S/C";

    let montoObjCadena = 0;
    let monto26Cadena = 0;
    for (const L of leavesCad) {
      montoObjCadena += num(L.monto_objetivo);
      monto26Cadena += num(L.monto_2026);
    }
    const varCadena = variacionPctVsObjetivo(montoObjCadena, monto26Cadena);

    const byCliente = new Map<number, { desc: string; leaves: FullSnapshotJerarquiaLeaf[] }>();
    for (const L of leavesCad) {
      const cur = byCliente.get(L.id_cliente) ?? { desc: L.descp_cliente, leaves: [] };
      cur.desc = L.descp_cliente;
      cur.leaves.push(L);
      byCliente.set(L.id_cliente, cur);
    }

    const hijosCliente: NodoJerarquia[] = [];

    for (const [idCliente, bucketCli] of byCliente) {
      const leavesCli = bucketCli.leaves;
      const displayCliente = bucketCli.desc || "S/I";

      let montoObjCliente = 0;
      let monto26Cliente = 0;
      for (const L of leavesCli) {
        montoObjCliente += num(L.monto_objetivo);
        monto26Cliente += num(L.monto_2026);
      }
      const varCliente = variacionPctVsObjetivo(montoObjCliente, monto26Cliente);

      const hijosMarca: NodoJerarquia[] = [];

      for (const L of leavesCli) {
        const mObj = num(L.monto_objetivo);
        const m26 = num(L.monto_2026);
        hijosMarca.push({
          tipo: "marca",
          nombre: L.descp_marca || "S/I",
          nivel: 3,
          montoObj: mObj,
          monto26: m26,
          variacionPct: L.variacion_vs_objetivo_pct,
          count: 1,
          path: `${idCadena}|${idCliente}|${L.id_marca}`,
          idCliente,
        });
      }

      hijosMarca.sort((a, b) => b.monto26 - a.monto26);

      hijosCliente.push({
        tipo: "cliente",
        nombre: displayCliente,
        nivel: 2,
        montoObj: montoObjCliente,
        monto26: monto26Cliente,
        variacionPct: varCliente,
        count: new Set(leavesCli.map((x) => x.id_marca)).size,
        hijos: hijosMarca,
        path: `${idCadena}|${idCliente}`,
        idCliente,
      });
    }

    hijosCliente.sort((a, b) => b.monto26 - a.monto26);

    jerarquia.push({
      tipo: "cadena",
      nombre: displayCadena,
      nivel: 1,
      montoObj: montoObjCadena,
      monto26: monto26Cadena,
      variacionPct: varCadena,
      count: new Set(leavesCad.map((x) => x.id_cliente)).size,
      hijos: hijosCliente,
      path: String(idCadena),
    });
  }

  jerarquia.sort((a, b) => b.monto26 - a.monto26);
  return jerarquia;
}

function FilaJerarquica({
  nodo,
  expandido,
  onToggle,
  segmentoPorClienteId,
}: {
  nodo: NodoJerarquia;
  expandido: boolean;
  onToggle: () => void;
  segmentoPorClienteId?: Map<number, SegmentoCarteraCliente>;
}) {
  const tieneHijos = Boolean(nodo.hijos?.length);
  const indent = (nodo.nivel - 1) * 20;

  const seg =
    nodo.idCliente != null && (nodo.nivel === 2 || nodo.nivel === 3)
      ? segmentoPorClienteId?.get(nodo.idCliente)
      : undefined;
  const segClass = seg ? claseSombraSegmento(seg) : "";

  const bgColor =
    nodo.nivel === 1
      ? "bg-gradient-to-r from-yellow-500/12 to-transparent"
      : nodo.nivel === 2
        ? "bg-white/[0.03]"
        : "";

  const textColor =
    nodo.nivel === 1
      ? "text-yellow-200/95 font-semibold"
      : nodo.nivel === 2
        ? "text-white/88 font-medium"
        : "text-white/72";

  const variacionColor =
    nodo.variacionPct === null
      ? "text-white/40"
      : nodo.variacionPct >= 0
        ? "text-emerald-400/95"
        : "text-red-400/95";

  return (
    <>
      <tr
        className={`${bgColor} ${segClass} border-b border-white/5 transition-colors ${tieneHijos ? "cursor-pointer hover:bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
        onClick={
          tieneHijos
            ? (e) => {
                e.stopPropagation();
                onToggle();
              }
            : undefined
        }
      >
        <td className="px-3 py-2.5 align-middle" style={{ paddingLeft: `${indent + 12}px` }}>
          <div className="flex min-w-0 items-center gap-2">
            {tieneHijos ? (
              <span className="w-3 shrink-0 text-center text-[10px] text-white/45">{expandido ? "▼" : "▶"}</span>
            ) : (
              <span className="w-3 shrink-0" />
            )}
            <span className={`min-w-0 truncate ${textColor}`}>
              {nodo.nombre}
              {nodo.nivel < 3 ? (
                <span className="ml-1.5 text-[10px] font-normal tabular-nums text-white/35">({nodo.count})</span>
              ) : null}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-white/55">{fmtGs(nodo.montoObj)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtGs(nodo.monto26)}</td>
        <td className={`px-3 py-2.5 text-right tabular-nums ${variacionColor}`}>{fmtPct(nodo.variacionPct)}</td>
      </tr>
      {expandido && tieneHijos
        ? nodo.hijos!.map((hijo) => (
            <FilaJerarquicaRecursiva key={hijo.path} nodo={hijo} segmentoPorClienteId={segmentoPorClienteId} />
          ))
        : null}
    </>
  );
}

function FilaJerarquicaRecursiva({
  nodo,
  segmentoPorClienteId,
}: {
  nodo: NodoJerarquia;
  segmentoPorClienteId?: Map<number, SegmentoCarteraCliente>;
}) {
  const [expandido, setExpandido] = useState(false);
  return (
    <FilaJerarquica
      nodo={nodo}
      expandido={expandido}
      onToggle={() => setExpandido((v) => !v)}
      segmentoPorClienteId={segmentoPorClienteId}
    />
  );
}

export function TablaJerarquica({
  jerarquiaLeaves,
  filterClienteIds,
  segmentoPorClienteId,
  title,
}: {
  jerarquiaLeaves: FullSnapshotJerarquiaLeaf[];
  /** Si se pasa, solo filas con `id_cliente` en el conjunto (p. ej. cartera crecimiento / riesgo). */
  filterClienteIds?: Set<number> | null;
  /** Opcional: sombra / borde por segmento en filas cliente y marca. */
  segmentoPorClienteId?: Map<number, SegmentoCarteraCliente>;
  title?: string;
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());

  const jerarquia = useMemo(
    () => construirJerarquiaDesdeHojas(jerarquiaLeaves, filterClienteIds),
    [jerarquiaLeaves, filterClienteIds]
  );

  const toggleNodo = (path: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!jerarquiaLeaves.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 py-10 text-center text-sm text-white/40">
        Sin jerarquía desde servidor (revisá conexión a BD o filtros).
      </div>
    );
  }

  if (!jerarquia.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 py-10 text-center text-sm text-white/40">
        Sin filas para esta cartera con los datos actuales (ids de cliente sin coincidencia en la jerarquía).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {title ? <p className="mb-2 text-[10px] uppercase tracking-wider text-white/35">{title}</p> : null}
      <table className="w-full min-w-[640px] table-fixed whitespace-nowrap text-left text-sm">
        <colgroup>
          <col className="w-[52%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md">
          <tr className="border-b border-white/15 text-[10px] uppercase tracking-wider text-white/45">
            <th className="px-3 py-3 font-normal">Estructura de análisis</th>
            <th className="px-3 py-3 text-right font-normal">Monto Obj</th>
            <th className="px-3 py-3 text-right font-normal">Monto 26</th>
            <th className="px-3 py-3 text-right font-normal">Variación %</th>
          </tr>
        </thead>
        <tbody>
          {jerarquia.map((nodo) => (
            <FilaJerarquica
              key={nodo.path}
              nodo={nodo}
              expandido={expandidos.has(nodo.path)}
              onToggle={() => toggleNodo(nodo.path)}
              segmentoPorClienteId={segmentoPorClienteId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
