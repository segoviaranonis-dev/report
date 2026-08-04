/**
 * Filas PDF desde FullSnapshot — columnas = Streamlit Sales Report (logic.py / ui.py).
 * Evolución: Semestre · Mes · Monto Obj · Monto 26 · Variación %
 * Cartera / Rankings / Detalle: aliases Monto Obj · Monto 26 · Variación %
 */
import type { FullSnapshotResponse } from "./full-snapshot-types";
import {
  ALIAS_CURRENT_VALUE,
  ALIAS_TARGET_VALUE,
  ALIAS_VARIATION,
  MES_MAP,
  MES_NOMBRES,
} from "@/modules/sales-report/constants";
import { variacionPctVsObjetivo } from "./variacion-objetivo";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function pick(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "") return r[k];
  }
  return "";
}

function semestreDeMes(mes: string): string {
  const idx = MES_MAP[mes] ?? 0;
  return idx <= 6 ? "1er SEMESTRE" : "2do SEMESTRE";
}

/**
 * Evolución mensual → filas PDF.
 * Orden canónico: Semestre · Mes · Monto Obj · Monto 26 · Variación %
 */
export function rowsEvolucion(snap: FullSnapshotResponse): Record<string, unknown>[] {
  return snap.evolucion_mensual.map((m) => ({
    Semestre: semestreDeMes(m.mes),
    Mes: m.mes,
    [ALIAS_TARGET_VALUE]: m.objetivo,
    [ALIAS_CURRENT_VALUE]: m.real_2026,
    [ALIAS_VARIATION]: m.desvio_pct,
  }));
}

/**
 * Cartera completa — visión general.
 * Jerarquía PDF: Cadena · Cliente · Marca · Mes · Monto Obj · Monto 26 · Variación %
 */
export function rowsCarteraCompleta(snap: FullSnapshotResponse): Record<string, unknown>[] {
  const leaves = snap.jerarquia_clientes ?? [];
  if (leaves.length) {
    type Acc = {
      Cadena: string;
      Cliente: string;
      Marca: string;
      Mes: string;
      mesIdx: number;
      obj: number;
      m26: number;
    };
    const map = new Map<string, Acc>();
    for (const L of leaves) {
      const cadena = String(L.descp_cadena || "S/C").trim() || "S/C";
      const cliente = String(L.descp_cliente || "S/D").trim() || "S/D";
      const marca = String(L.descp_marca || "S/I").trim() || "S/I";
      const mesIdx = Math.round(n(L.mes_idx));
      const mes = MES_NOMBRES[mesIdx] || (mesIdx > 0 ? String(mesIdx) : "S/D");
      const key = `${L.id_cadena}\u0001${L.id_cliente}\u0001${L.id_marca}\u0001${mesIdx}`;
      let acc = map.get(key);
      if (!acc) {
        acc = { Cadena: cadena, Cliente: cliente, Marca: marca, Mes: mes, mesIdx, obj: 0, m26: 0 };
        map.set(key, acc);
      }
      acc.obj += n(L.monto_objetivo);
      acc.m26 += n(L.monto_2026);
    }
    return [...map.values()]
      .sort((a, b) => {
        const c = a.Cadena.localeCompare(b.Cadena);
        if (c) return c;
        const cl = a.Cliente.localeCompare(b.Cliente);
        if (cl) return cl;
        const m = a.Marca.localeCompare(b.Marca);
        if (m) return m;
        return a.mesIdx - b.mesIdx;
      })
      .map((r) => ({
        Cadena: r.Cadena,
        Cliente: r.Cliente,
        Marca: r.Marca,
        Mes: r.Mes,
        [ALIAS_TARGET_VALUE]: r.obj,
        [ALIAS_CURRENT_VALUE]: r.m26,
        [ALIAS_VARIATION]: variacionPctVsObjetivo(r.obj, r.m26),
      }));
  }

  const out: Record<string, unknown>[] = [];
  for (const c of [...snap.clientes_crecimiento, ...snap.clientes_riesgo]) {
    const obj = n(c.objetivo);
    const m26 = n(c.monto_2026);
    out.push({
      Cadena: c.cadena || "S/C",
      Cliente: c.nombre,
      Marca: c.marca_principal || "S/I",
      Mes: "—",
      [ALIAS_TARGET_VALUE]: obj,
      [ALIAS_CURRENT_VALUE]: m26,
      [ALIAS_VARIATION]: variacionPctVsObjetivo(obj, m26),
    });
  }
  for (const c of snap.clientes_sin_compra) {
    const obj = n(c.objetivo) || n(c.ultimo_monto);
    out.push({
      Cadena: c.cadena || "S/C",
      Cliente: c.nombre,
      Marca: "—",
      Mes: c.ultimo_mes || "—",
      [ALIAS_TARGET_VALUE]: obj,
      [ALIAS_CURRENT_VALUE]: 0,
      [ALIAS_VARIATION]: variacionPctVsObjetivo(obj, 0),
    });
  }
  return out;
}

/** @deprecated Usar rowsCarteraCompleta — sin división por estado. */
export function rowsCarteraUnificada(snap: FullSnapshotResponse): Record<string, unknown>[] {
  return rowsCarteraCompleta(snap);
}

/** Ranking marcas Streamlit: Marca · Monto Obj · Monto 26 · Variación % */
export function rowsRankingMarcas(snap: FullSnapshotResponse): Record<string, unknown>[] {
  return snap.ranking_marcas.map((m) => ({
    Marca: m.marca,
    [ALIAS_TARGET_VALUE]: m.objetivo,
    [ALIAS_CURRENT_VALUE]: m.monto_2026,
    [ALIAS_VARIATION]: variacionPctVsObjetivo(m.objetivo, m.monto_2026),
  }));
}

/** Ranking vendedores Streamlit: Vendedor · Monto Obj · Monto 26 · Variación % */
export function rowsRankingVendedores(snap: FullSnapshotResponse): Record<string, unknown>[] {
  return snap.ranking_vendedores.map((v) => ({
    Vendedor: v.vendedor,
    [ALIAS_TARGET_VALUE]: v.objetivo,
    [ALIAS_CURRENT_VALUE]: v.monto_2026,
    [ALIAS_VARIATION]: variacionPctVsObjetivo(v.objetivo, v.monto_2026),
  }));
}

/**
 * Detalle operativo → Matriz Marca / Gestión Vendedores (Streamlit aliases).
 */
export function rowsDetalleOperativo(snap: FullSnapshotResponse): Record<string, unknown>[] {
  return (snap.detalle_operativo as Record<string, unknown>[]).map((r) => {
    const mesIdx = n(pick(r, "mes_idx"));
    const monto26 = n(pick(r, ALIAS_CURRENT_VALUE, "monto_26", "Monto 26"));
    const montoObj = n(pick(r, ALIAS_TARGET_VALUE, "monto_objetivo", "Monto Obj"));
    const varPct = pick(r, ALIAS_VARIATION, "variacion_pct");
    return {
      Marca: String(pick(r, "marca", "Marca", "descp_marca") || "S/I"),
      Cadena: String(pick(r, "cadena", "Cadena", "descp_cadena") || "S/C"),
      Cliente: String(pick(r, "cliente", "Cliente", "descp_cliente") || "S/D"),
      Vendedor: String(pick(r, "vendedor", "Vendedor", "descp_vendedor") || "S/V"),
      Mes: String(pick(r, "mes", "Mes") || MES_NOMBRES[mesIdx] || mesIdx || ""),
      [ALIAS_TARGET_VALUE]: montoObj,
      [ALIAS_CURRENT_VALUE]: monto26,
      [ALIAS_VARIATION]:
        varPct === null || varPct === undefined || varPct === ""
          ? variacionPctVsObjetivo(montoObj, monto26)
          : Number(varPct),
    };
  });
}
