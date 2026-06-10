"use client";

import { useMemo, useState } from "react";
import type { FullSnapshotJerarquiaLeaf } from "@/lib/rimec/full-snapshot-types";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";
import { MES_NOMBRES } from "@/modules/sales-report/constants";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type NodoJerarquia = {
  tipo: "cadena" | "cliente" | "marca" | "mes";
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
  /** Índice del mes (1-12) para ordenamiento cronológico */
  mes_idx?: number;
};

export type SegmentoCarteraCliente = "crecimiento" | "riesgo" | "sin_compra";

function claseSombraSegmento(segmento: SegmentoCarteraCliente): string {
  switch (segmento) {
    case "crecimiento":
      return "shadow-[0_0_16px_-5px_rgba(47,79,62,0.30)] border-l-2 border-l-semantic-success";
    case "riesgo":
      return "shadow-[0_0_16px_-5px_rgba(249,115,22,0.38)] border-l-2 border-l-rimec-azul/60";
    case "sin_compra":
      return "shadow-[0_0_16px_-5px_rgba(140,59,59,0.28)] border-l-2 border-l-rimec-azul";
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
    const displayCadena = bucketCad.desc || "Clientes sin cadenas";

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

      // Agrupar por marca
      const byMarca = new Map<number, { desc: string; leaves: FullSnapshotJerarquiaLeaf[] }>();
      for (const L of leavesCli) {
        const cur = byMarca.get(L.id_marca) ?? { desc: L.descp_marca, leaves: [] };
        cur.desc = L.descp_marca;
        cur.leaves.push(L);
        byMarca.set(L.id_marca, cur);
      }

      const hijosMarca: NodoJerarquia[] = [];

      for (const [idMarca, bucketMarca] of byMarca) {
        const leavesMarca = bucketMarca.leaves;
        const displayMarca = bucketMarca.desc || "S/I";

        let montoObjMarca = 0;
        let monto26Marca = 0;
        for (const L of leavesMarca) {
          montoObjMarca += num(L.monto_objetivo);
          monto26Marca += num(L.monto_2026);
        }
        const varMarca = variacionPctVsObjetivo(montoObjMarca, monto26Marca);

        // Construir hijos de mes
        const hijosMes: NodoJerarquia[] = [];
        for (const L of leavesMarca) {
          const nombreMes = MES_NOMBRES[L.mes_idx] || `Mes ${L.mes_idx}`;
          const mObj = num(L.monto_objetivo);
          const m26 = num(L.monto_2026);
          hijosMes.push({
            tipo: "mes",
            nombre: nombreMes,
            nivel: 4,
            montoObj: mObj,
            monto26: m26,
            variacionPct: L.variacion_vs_objetivo_pct,
            count: 1,
            path: `${idCadena}|${idCliente}|${idMarca}|${L.mes_idx}`,
            idCliente,
            mes_idx: L.mes_idx,  // Guardar mes_idx para ordenar
          });
        }

        // Ordenar por mes cronológico (no por monto)
        hijosMes.sort((a, b) => (a.mes_idx || 0) - (b.mes_idx || 0));

        hijosMarca.push({
          tipo: "marca",
          nombre: displayMarca,
          nivel: 3,
          montoObj: montoObjMarca,
          monto26: monto26Marca,
          variacionPct: varMarca,
          count: hijosMes.length,
          hijos: hijosMes,
          path: `${idCadena}|${idCliente}|${idMarca}`,
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
      ? "bg-gradient-to-r from-rimec-azul-light/15 to-transparent"
      : nodo.nivel === 2
        ? "bg-rimec-azul/5"
        : "";

  const textColor =
    nodo.nivel === 1
      ? "text-rimec-azul font-semibold"
      : nodo.nivel === 2
        ? "text-neutral-ink font-medium"
        : "text-neutral-ink-medium";

  const variacionColor =
    nodo.variacionPct === null
      ? "text-neutral-ink-muted"
      : nodo.variacionPct >= 0
        ? "text-semantic-success"
        : "text-rimec-azul";

  return (
    <>
      <tr
        className={`${bgColor} ${segClass} border-b border-rimec-azul/10 transition-colors ${tieneHijos ? "cursor-pointer hover:bg-rimec-azul/5" : "hover:bg-rimec-azul/5"}`}
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
              <span className="w-3 shrink-0 text-center text-[10px] text-neutral-ink-muted">{expandido ? "▼" : "▶"}</span>
            ) : (
              <span className="w-3 shrink-0" />
            )}
            <span className={`min-w-0 truncate ${textColor}`}>
              {nodo.nombre}
              {nodo.nivel < 3 ? (
                <span className="ml-1.5 text-[10px] font-normal tabular-nums text-neutral-ink-muted">({nodo.count})</span>
              ) : null}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-ink-medium">{fmtGs(nodo.montoObj)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-ink">{fmtGs(nodo.monto26)}</td>
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
      <div className="rounded-lg border border-rimec-azul/15 bg-app-bg py-10 text-center text-sm text-neutral-ink-muted">
        Sin jerarquía desde servidor (revisá conexión a BD o filtros).
      </div>
    );
  }

  if (!jerarquia.length) {
    return (
      <div className="rounded-lg border border-rimec-azul/15 bg-app-bg py-10 text-center text-sm text-neutral-ink-muted">
        Sin filas para esta cartera con los datos actuales (ids de cliente sin coincidencia en la jerarquía).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {title ? <p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-ink-muted">{title}</p> : null}
      <table className="w-full min-w-[640px] table-fixed whitespace-nowrap text-left text-sm">
        <colgroup>
          <col className="w-[52%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white backdrop-blur-md">
          <tr className="border-b border-rimec-azul/20 text-[10px] uppercase tracking-wider text-neutral-ink-muted">
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
