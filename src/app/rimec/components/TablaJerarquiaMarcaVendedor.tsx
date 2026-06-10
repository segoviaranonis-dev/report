"use client";

/**
 * Tabla 6 (pestaña Marcas): acordeón Marca → Cadena → Cliente → Vendedor
 * a partir del detalle pivot enriquecido (mismas columnas que Sales Report / v_ventas_pivot).
 */

import { useMemo, useState } from "react";
import { ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE } from "@/modules/sales-report/constants";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pathKey(m: string, c: string, cl: string, v: string) {
  return [m, c, cl, v].map((s) => encodeURIComponent(s)).join("|");
}

export type NodoJerarquiaMarca = {
  tipo: "marca" | "cadena" | "cliente" | "vendedor";
  nombre: string;
  nivel: number;
  montoObj: number;
  monto26: number;
  variacionPct: number | null;
  count: number;
  hijos?: NodoJerarquiaMarca[];
  path: string;
};

type HojaMarcaVendedor = {
  marca: string;
  cadena: string;
  cliente: string;
  vendedor: string;
  montoObj: number;
  monto26: number;
};

function agregarHojas(detalle: Record<string, unknown>[]): HojaMarcaVendedor[] {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  const map = new Map<string, HojaMarcaVendedor>();
  for (const r of detalle) {
    const marca = String(r.marca ?? "S/I").trim();
    const cadena = String(r.cadena ?? "Clientes sin cadenas").trim();
    const cliente = String(r.cliente ?? "S/I").trim();
    const vendedor = String(r.vendedor ?? "S/I").trim();
    const key = `${marca}\u0001${cadena}\u0001${cliente}\u0001${vendedor}`;
    const cur = map.get(key) ?? { marca, cadena, cliente, vendedor, montoObj: 0, monto26: 0 };
    cur.montoObj += num(r[t]);
    cur.monto26 += num(r[a]);
    map.set(key, cur);
  }
  return Array.from(map.values());
}

export function construirJerarquiaMarcaCadenaClienteVendedor(leaves: HojaMarcaVendedor[]): NodoJerarquiaMarca[] {
  const byMarca = new Map<string, HojaMarcaVendedor[]>();
  for (const L of leaves) {
    if (!byMarca.has(L.marca)) byMarca.set(L.marca, []);
    byMarca.get(L.marca)!.push(L);
  }

  const raiz: NodoJerarquiaMarca[] = [];

  for (const [marca, leavesMar] of byMarca) {
    const byCadena = new Map<string, HojaMarcaVendedor[]>();
    for (const L of leavesMar) {
      if (!byCadena.has(L.cadena)) byCadena.set(L.cadena, []);
      byCadena.get(L.cadena)!.push(L);
    }

    const hijosCadena: NodoJerarquiaMarca[] = [];

    for (const [cadena, leavesCad] of byCadena) {
      const byCliente = new Map<string, HojaMarcaVendedor[]>();
      for (const L of leavesCad) {
        if (!byCliente.has(L.cliente)) byCliente.set(L.cliente, []);
        byCliente.get(L.cliente)!.push(L);
      }

      const hijosCliente: NodoJerarquiaMarca[] = [];

      for (const [cliente, leavesCli] of byCliente) {
        const hijosVend: NodoJerarquiaMarca[] = [];
        for (const L of leavesCli) {
          hijosVend.push({
            tipo: "vendedor",
            nombre: L.vendedor || "S/I",
            nivel: 4,
            montoObj: L.montoObj,
            monto26: L.monto26,
            variacionPct: variacionPctVsObjetivo(L.montoObj, L.monto26),
            count: 1,
            path: pathKey(marca, cadena, cliente, L.vendedor),
          });
        }
        hijosVend.sort((a, b) => b.monto26 - a.monto26);

        let mObjC = 0;
        let m26C = 0;
        for (const L of leavesCli) {
          mObjC += L.montoObj;
          m26C += L.monto26;
        }
        hijosCliente.push({
          tipo: "cliente",
          nombre: cliente,
          nivel: 3,
          montoObj: mObjC,
          monto26: m26C,
          variacionPct: variacionPctVsObjetivo(mObjC, m26C),
          count: hijosVend.length,
          hijos: hijosVend,
          path: pathKey(marca, cadena, cliente, ""),
        });
      }
      hijosCliente.sort((a, b) => b.monto26 - a.monto26);

      let mObjCad = 0;
      let m26Cad = 0;
      for (const L of leavesCad) {
        mObjCad += L.montoObj;
        m26Cad += L.monto26;
      }
      hijosCadena.push({
        tipo: "cadena",
        nombre: cadena,
        nivel: 2,
        montoObj: mObjCad,
        monto26: m26Cad,
        variacionPct: variacionPctVsObjetivo(mObjCad, m26Cad),
        count: hijosCliente.length,
        hijos: hijosCliente,
        path: pathKey(marca, cadena, "", ""),
      });
    }
    hijosCadena.sort((a, b) => b.monto26 - a.monto26);

    let mObjM = 0;
    let m26M = 0;
    for (const L of leavesMar) {
      mObjM += L.montoObj;
      m26M += L.monto26;
    }
    raiz.push({
      tipo: "marca",
      nombre: marca,
      nivel: 1,
      montoObj: mObjM,
      monto26: m26M,
      variacionPct: variacionPctVsObjetivo(mObjM, m26M),
      count: hijosCadena.length,
      hijos: hijosCadena,
      path: pathKey(marca, "", "", ""),
    });
  }

  raiz.sort((a, b) => b.monto26 - a.monto26);
  return raiz;
}

function FilaMarca({
  nodo,
  expandido,
  onToggle,
}: {
  nodo: NodoJerarquiaMarca;
  expandido: boolean;
  onToggle: () => void;
}) {
  const tieneHijos = Boolean(nodo.hijos?.length);
  const indent = (nodo.nivel - 1) * 18;

  const bgColor =
    nodo.nivel === 1
      ? "bg-gradient-to-r from-rimec-azul-light/15 to-transparent"
      : nodo.nivel === 2
        ? "bg-rimec-azul/5"
        : "";

  const textColor =
    nodo.nivel === 1
      ? "text-rimec-text-rimec-azul font-semibold"
      : nodo.nivel === 2
        ? "text-neutral-ink font-medium"
        : nodo.nivel === 3
          ? "text-neutral-ink/78"
          : "text-neutral-ink/65";

  const variacionColor =
    nodo.variacionPct === null
      ? "text-neutral-ink-muted"
      : nodo.variacionPct >= 0
        ? "text-semantic-success"
        : "text-semantic-error";

  const variacionBg =
    nodo.variacionPct !== null && nodo.variacionPct < 0 ? "bg-semantic-error/10" : "";

  return (
    <>
      <tr
        className={`${bgColor} border-b border-rimec-azul/10 transition-colors ${tieneHijos ? "cursor-pointer hover:bg-rimec-azul/5" : "hover:bg-rimec-azul/5"}`}
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
              {nodo.nivel < 4 ? (
                <span className="ml-1.5 text-[10px] font-normal tabular-nums text-neutral-ink-muted">({nodo.count})</span>
              ) : null}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-ink-medium">{fmtGs(nodo.montoObj)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-ink">{fmtGs(nodo.monto26)}</td>
        <td className={`px-3 py-2.5 text-right tabular-nums ${variacionColor} ${variacionBg}`}>{fmtPct(nodo.variacionPct)}</td>
      </tr>
      {expandido && tieneHijos
        ? nodo.hijos!.map((hijo) => <FilaMarcaRecursiva key={hijo.path} nodo={hijo} />)
        : null}
    </>
  );
}

function FilaMarcaRecursiva({ nodo }: { nodo: NodoJerarquiaMarca }) {
  const [expandido, setExpandido] = useState(false);
  return (
    <FilaMarca
      nodo={nodo}
      expandido={expandido}
      onToggle={() => setExpandido((v) => !v)}
    />
  );
}

export function TablaJerarquiaMarcaCadenaClienteVendedor({
  detalleOperativo,
}: {
  detalleOperativo: Record<string, unknown>[];
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());

  const jerarquia = useMemo(() => {
    const hojas = agregarHojas(detalleOperativo);
    return construirJerarquiaMarcaCadenaClienteVendedor(hojas);
  }, [detalleOperativo]);

  const toggleNodo = (path: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!detalleOperativo.length) {
    return (
      <div className="rounded-lg border border-rimec-azul/15 bg-app-bg py-10 text-center text-sm text-neutral-ink-muted">
        Sin detalle operativo para armar la jerarquía.
      </div>
    );
  }

  if (!jerarquia.length) {
    return (
      <div className="rounded-lg border border-rimec-azul/15 bg-app-bg py-10 text-center text-sm text-neutral-ink-muted">
        No hay filas agrupables (marca / cadena / cliente / vendedor).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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
            <FilaMarca
              key={nodo.path}
              nodo={nodo}
              expandido={expandidos.has(nodo.path)}
              onToggle={() => toggleNodo(nodo.path)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
