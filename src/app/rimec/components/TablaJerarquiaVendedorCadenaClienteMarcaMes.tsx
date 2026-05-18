"use client";

/**
 * Tabla 8 (pestaña Vendedores): acordeón Vendedor → Cadena → Cliente → Marca → Mes
 * (paridad con Streamlit / RimecClient: árbol de 5 niveles sobre el pivot enriquecido).
 */

import { useMemo, useState } from "react";
import { ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, MES_NOMBRES } from "@/modules/sales-report/constants";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function etiquetaMes(r: Record<string, unknown>): string {
  const idx = Math.round(num(r.mes_idx));
  if (idx >= 1 && idx <= 12) return MES_NOMBRES[idx] ?? `Mes ${idx}`;
  const s = String(r.mes ?? "").trim();
  return s || "S/I";
}

function pathKey(v: string, c: string, cl: string, m: string, mes: string) {
  return [v, c, cl, m, mes].map((s) => encodeURIComponent(s)).join("|");
}

export type NodoJerarquiaVend = {
  tipo: "vendedor" | "cadena" | "cliente" | "marca" | "mes";
  nombre: string;
  nivel: number;
  montoObj: number;
  monto26: number;
  variacionPct: number | null;
  count: number;
  hijos?: NodoJerarquiaVend[];
  path: string;
};

type HojaVendMes = {
  vendedor: string;
  cadena: string;
  cliente: string;
  marca: string;
  mes: string;
  montoObj: number;
  monto26: number;
};

function agregarHojas(detalle: Record<string, unknown>[]): HojaVendMes[] {
  const a = ALIAS_CURRENT_VALUE;
  const t = ALIAS_TARGET_VALUE;
  const map = new Map<string, HojaVendMes>();
  for (const r of detalle) {
    const vendedor = String(r.vendedor ?? "S/I").trim();
    const cadena = String(r.cadena ?? "S/C").trim();
    const cliente = String(r.cliente ?? "S/I").trim();
    const marca = String(r.marca ?? "S/I").trim();
    const mes = etiquetaMes(r);
    const key = `${vendedor}\u0001${cadena}\u0001${cliente}\u0001${marca}\u0001${mes}`;
    const cur = map.get(key) ?? { vendedor, cadena, cliente, marca, mes, montoObj: 0, monto26: 0 };
    cur.montoObj += num(r[t]);
    cur.monto26 += num(r[a]);
    map.set(key, cur);
  }
  return Array.from(map.values());
}

export function construirJerarquiaVendedorCadenaClienteMarcaMes(leaves: HojaVendMes[]): NodoJerarquiaVend[] {
  const byVend = new Map<string, HojaVendMes[]>();
  for (const L of leaves) {
    if (!byVend.has(L.vendedor)) byVend.set(L.vendedor, []);
    byVend.get(L.vendedor)!.push(L);
  }

  const raiz: NodoJerarquiaVend[] = [];

  for (const [vendedor, leavesV] of byVend) {
    const byCadena = new Map<string, HojaVendMes[]>();
    for (const L of leavesV) {
      if (!byCadena.has(L.cadena)) byCadena.set(L.cadena, []);
      byCadena.get(L.cadena)!.push(L);
    }

    const hijosCadena: NodoJerarquiaVend[] = [];

    for (const [cadena, leavesCad] of byCadena) {
      const byCliente = new Map<string, HojaVendMes[]>();
      for (const L of leavesCad) {
        if (!byCliente.has(L.cliente)) byCliente.set(L.cliente, []);
        byCliente.get(L.cliente)!.push(L);
      }

      const hijosCliente: NodoJerarquiaVend[] = [];

      for (const [cliente, leavesCli] of byCliente) {
        const byMarca = new Map<string, HojaVendMes[]>();
        for (const L of leavesCli) {
          if (!byMarca.has(L.marca)) byMarca.set(L.marca, []);
          byMarca.get(L.marca)!.push(L);
        }

        const hijosMarca: NodoJerarquiaVend[] = [];

        for (const [marca, leavesMar] of byMarca) {
          const hijosMes: NodoJerarquiaVend[] = [];
          for (const L of leavesMar) {
            hijosMes.push({
              tipo: "mes",
              nombre: L.mes,
              nivel: 5,
              montoObj: L.montoObj,
              monto26: L.monto26,
              variacionPct: variacionPctVsObjetivo(L.montoObj, L.monto26),
              count: 1,
              path: pathKey(vendedor, cadena, cliente, marca, L.mes),
            });
          }
          hijosMes.sort((a, b) => b.monto26 - a.monto26);

          let mObjM = 0;
          let m26M = 0;
          for (const L of leavesMar) {
            mObjM += L.montoObj;
            m26M += L.monto26;
          }
          hijosMarca.push({
            tipo: "marca",
            nombre: marca,
            nivel: 4,
            montoObj: mObjM,
            monto26: m26M,
            variacionPct: variacionPctVsObjetivo(mObjM, m26M),
            count: hijosMes.length,
            hijos: hijosMes,
            path: pathKey(vendedor, cadena, cliente, marca, ""),
          });
        }
        hijosMarca.sort((a, b) => b.monto26 - a.monto26);

        let mObjCli = 0;
        let m26Cli = 0;
        for (const L of leavesCli) {
          mObjCli += L.montoObj;
          m26Cli += L.monto26;
        }
        hijosCliente.push({
          tipo: "cliente",
          nombre: cliente,
          nivel: 3,
          montoObj: mObjCli,
          monto26: m26Cli,
          variacionPct: variacionPctVsObjetivo(mObjCli, m26Cli),
          count: hijosMarca.length,
          hijos: hijosMarca,
          path: pathKey(vendedor, cadena, cliente, "", ""),
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
        path: pathKey(vendedor, cadena, "", "", ""),
      });
    }
    hijosCadena.sort((a, b) => b.monto26 - a.monto26);

    let mObjV = 0;
    let m26V = 0;
    for (const L of leavesV) {
      mObjV += L.montoObj;
      m26V += L.monto26;
    }
    raiz.push({
      tipo: "vendedor",
      nombre: vendedor,
      nivel: 1,
      montoObj: mObjV,
      monto26: m26V,
      variacionPct: variacionPctVsObjetivo(mObjV, m26V),
      count: hijosCadena.length,
      hijos: hijosCadena,
      path: pathKey(vendedor, "", "", "", ""),
    });
  }

  raiz.sort((a, b) => b.monto26 - a.monto26);
  return raiz;
}

function FilaVend({
  nodo,
  expandido,
  onToggle,
}: {
  nodo: NodoJerarquiaVend;
  expandido: boolean;
  onToggle: () => void;
}) {
  const tieneHijos = Boolean(nodo.hijos?.length);
  const indent = (nodo.nivel - 1) * 18;

  const bgColor =
    nodo.nivel === 1
      ? "bg-gradient-to-r from-sky-500/14 to-transparent"
      : nodo.nivel === 2
        ? "bg-white/[0.03]"
        : "";

  const textColor =
    nodo.nivel === 1
      ? "text-sky-200/95 font-semibold"
      : nodo.nivel === 2
        ? "text-white/88 font-medium"
        : nodo.nivel === 3
          ? "text-white/78"
          : nodo.nivel === 4
            ? "text-white/72"
            : "text-white/62";

  const variacionColor =
    nodo.variacionPct === null
      ? "text-white/40"
      : nodo.variacionPct >= 0
        ? "text-emerald-400/95"
        : "text-red-400/95";

  const variacionBg = nodo.variacionPct !== null && nodo.variacionPct < 0 ? "bg-red-500/10" : "";

  return (
    <>
      <tr
        className={`${bgColor} border-b border-white/5 transition-colors ${tieneHijos ? "cursor-pointer hover:bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
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
              {nodo.nivel < 5 ? (
                <span className="ml-1.5 text-[10px] font-normal tabular-nums text-white/35">({nodo.count})</span>
              ) : null}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-white/55">{fmtGs(nodo.montoObj)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtGs(nodo.monto26)}</td>
        <td className={`px-3 py-2.5 text-right tabular-nums ${variacionColor} ${variacionBg}`}>{fmtPct(nodo.variacionPct)}</td>
      </tr>
      {expandido && tieneHijos
        ? nodo.hijos!.map((hijo) => <FilaVendRecursiva key={hijo.path} nodo={hijo} />)
        : null}
    </>
  );
}

function FilaVendRecursiva({ nodo }: { nodo: NodoJerarquiaVend }) {
  const [expandido, setExpandido] = useState(false);
  return <FilaVend nodo={nodo} expandido={expandido} onToggle={() => setExpandido((v) => !v)} />;
}

export function TablaJerarquiaVendedorCadenaClienteMarcaMes({
  detalleOperativo,
}: {
  detalleOperativo: Record<string, unknown>[];
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());

  const jerarquia = useMemo(() => {
    const hojas = agregarHojas(detalleOperativo);
    return construirJerarquiaVendedorCadenaClienteMarcaMes(hojas);
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
      <div className="rounded-lg border border-white/10 bg-black/20 py-10 text-center text-sm text-white/40">
        Sin detalle operativo para armar la jerarquía.
      </div>
    );
  }

  if (!jerarquia.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 py-10 text-center text-sm text-white/40">
        No hay filas agrupables (vendedor / cadena / cliente / marca / mes).
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
            <FilaVend
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
