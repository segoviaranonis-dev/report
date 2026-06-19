"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ALM_DEPOSITO_RIMEC } from "@/lib/rimec-abastecimiento/constants";
import type { CompraDistribuida, DepositoKpis, DepositoSaldoRow } from "@/lib/deposito-rimec/types";
import { DEPOSITO_RIMEC } from "@/lib/report/routes";

export function DepositoRimecHubClient() {
  const [saldo, setSaldo] = useState<DepositoSaldoRow[]>([]);
  const [kpis, setKpis] = useState<DepositoKpis | null>(null);
  const [compras, setCompras] = useState<CompraDistribuida[]>([]);
  const [clFilter, setClFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompras = useCallback(async () => {
    try {
      const res = await fetch("/api/deposito-rimec/compras");
      const data = await res.json();
      if (data.compras) setCompras(data.compras);
    } catch {
      /* ignore */
    }
  }, []);

  const loadSaldo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = clFilter !== "" ? `?compra_legal_id=${clFilter}` : "";
      const res = await fetch(`/api/deposito-rimec/saldo${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.configured === false) {
        setConfigured(false);
        return;
      }
      setConfigured(true);
      setSaldo(data.saldo ?? []);
      setKpis(data.kpis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [clFilter]);

  useEffect(() => {
    loadCompras();
  }, [loadCompras]);

  useEffect(() => {
    loadSaldo();
  }, [loadSaldo]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="deposito-rimec" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.10 · RIMEC
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Depósito RIMEC</h1>
        <p className="mt-2 max-w-2xl text-neutral-700">
          Saldo físico importadora (<code className="text-sm">ALM_DEPOSITO_RIMEC</code> id={ALM_DEPOSITO_RIMEC}) —
          inicial (PPD) − vendido (FI) = saldo. OR-NEXUS-DEPOSITO-RIMEC-CONSISTENCIA-001.
        </p>

        {!configured && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL no configurada.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs font-bold uppercase text-neutral-500">Filtrar por CL</span>
            <select
              value={clFilter}
              onChange={(e) => setClFilter(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              className="mt-1 block rounded-lg border-2 border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas las compras distribuidas</option>
              {compras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_registro} ({c.estado})
                </option>
              ))}
            </select>
          </label>
        </div>

        {kpis && (
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { l: "Moléculas con saldo", v: kpis.filas },
              { l: "Pares inicial", v: kpis.total_inicial },
              { l: "Vendido (FI)", v: kpis.total_vendido },
              { l: "Saldo", v: kpis.total_saldo },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border-2 border-neutral-300 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-neutral-500">{k.l}</p>
                <p className="mt-1 font-serif text-2xl tabular-nums text-rimec-azul-dark">
                  {k.v.toLocaleString("es-PY")}
                </p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {loading ? (
          <p className="mt-8 text-neutral-600">Cargando saldo…</p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border-2 border-neutral-300 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Marca</th>
                  <th className="px-3 py-2">PP</th>
                  <th className="px-3 py-2">L+R</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Color</th>
                  <th className="px-3 py-2">Grada</th>
                  <th className="px-3 py-2 text-right">Inicial</th>
                  <th className="px-3 py-2 text-right">Vendido</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {saldo.map((r) => (
                  <tr key={r.ppd_id} className="border-t border-neutral-200">
                    <td className="px-3 py-1.5">{r.marca}</td>
                    <td className="px-3 py-1.5">{r.pedido}</td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {r.linea}.{r.referencia}
                    </td>
                    <td className="px-3 py-1.5">{r.material}</td>
                    <td className="px-3 py-1.5">{r.color}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.grada}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.cantidad_inicial}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.vendido}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{r.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!saldo.length && configured && (
              <p className="p-6 text-neutral-600">Sin saldo positivo para el filtro seleccionado.</p>
            )}
          </div>
        )}
      </main>
      <ReportFooter note={`Depósito RIMEC · ${DEPOSITO_RIMEC} · 2.3.1.10`} />
    </div>
  );
}
