"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import type { CasoBibliotecaLite } from "@/lib/depositos/caso-biblioteca";
import { PROVEEDOR_CALZADO } from "@/lib/depositos/pilar-proveedor-index";

type BibliotecaRow = {
  id: number;
  nombre: string;
  casos_count: number;
  lineas_count: number;
  canonica: boolean;
};

type Props = {
  clienteId?: number;
  categoria?: CategoriaDeposito;
  /** PE RIMEC: `/api/stock-pronta-entrega/filtros-indice` */
  indiceApiPath?: string;
  bibliotecaId: number | null;
  casoActivo: string | null;
  onBibliotecaChange: (id: number | null) => void;
  onCasoChange: (nombre: string | null) => void;
  onCasosLoaded: (casos: CasoBibliotecaLite[]) => void;
};

export function BibliotecaCasoBar({
  clienteId,
  categoria = "tienda",
  indiceApiPath,
  bibliotecaId,
  casoActivo,
  onBibliotecaChange,
  onCasoChange,
  onCasosLoaded,
}: Props) {
  const [bibliotecas, setBibliotecas] = useState<BibliotecaRow[]>([]);
  const [casos, setCasos] = useState<CasoBibliotecaLite[]>([]);
  const [bibliotecaActiva, setBibliotecaActiva] = useState<BibliotecaRow | null>(null);
  const [lineasBcl, setLineasBcl] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const catParam =
    indiceApiPath || categoria === "tienda" ? "" : `&categoria=${categoria}`;
  const indiceBase =
    indiceApiPath ??
    (clienteId != null ? `/api/depositos/${clienteId}/filtros-indice` : null);

  const cargarCasos = useCallback(
    async (bibId: number) => {
      if (!indiceBase) throw new Error("API filtros-indice no configurada");
      const r = await fetch(
        `${indiceBase}?proveedor_id=${PROVEEDOR_CALZADO}&biblioteca_id=${bibId}${catParam}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? "Error al cargar casos");
      const bib = j.biblioteca as BibliotecaRow;
      const lista = (j.casos ?? []) as CasoBibliotecaLite[];
      setBibliotecaActiva(bib);
      setLineasBcl(typeof j.resumen?.n_asignadas === "number" ? j.resumen.n_asignadas : null);
      setCasos(lista);
      onCasosLoaded(lista);
    },
    [catParam, indiceBase, onCasosLoaded],
  );

  useEffect(() => {
    if (!indiceBase) {
      setErr("Depósito sin API biblioteca");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);

    fetch(`${indiceBase}?proveedor_id=${PROVEEDOR_CALZADO}${catParam}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(async (j) => {
        if (cancelled) return;
        if (j.error) {
          setErr(j.error);
          return;
        }
        const lista = (j.bibliotecas ?? []) as BibliotecaRow[];
        setBibliotecas(lista);
        const canonica =
          (j.canonica as BibliotecaRow | null) ?? lista.find((b) => b.canonica) ?? lista[0] ?? null;
        const id = bibliotecaId ?? canonica?.id ?? null;
        if (id != null) {
          onBibliotecaChange(id);
          await cargarCasos(id);
        } else {
          onCasosLoaded([]);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error biblioteca");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init por API base
  }, [indiceBase, categoria]);

  async function onSelectBiblioteca(id: number) {
    onBibliotecaChange(id);
    onCasoChange(null);
    setLoading(true);
    setErr(null);
    try {
      await cargarCasos(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setCasos([]);
      onCasosLoaded([]);
    } finally {
      setLoading(false);
    }
  }

  const motorHref = bibliotecaId
    ? `/proceso-importacion/motor-precios/biblioteca/${bibliotecaId}`
    : "/proceso-importacion/motor-precios/biblioteca";

  return (
    <div className="mx-auto max-w-7xl px-4">
      <div className="rounded-2xl border-2 border-rimec-azul/25 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">
              Motor precios · biblioteca vinculada
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-gray-600" htmlFor="bib-select">
                Biblioteca
              </label>
              <select
                id="bib-select"
                value={bibliotecaId ?? ""}
                disabled={loading || bibliotecas.length === 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) void onSelectBiblioteca(v);
                }}
                className="min-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900"
              >
                {bibliotecas.length === 0 ? (
                  <option value="">Sin bibliotecas</option>
                ) : (
                  bibliotecas.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.id} · {b.nombre}
                      {b.canonica ? " · canónica" : ""} · {b.casos_count} casos
                    </option>
                  ))
                )}
              </select>
              {bibliotecaActiva ? (
                <span className="text-xs text-gray-500">
                  {lineasBcl ?? bibliotecaActiva.lineas_count ?? "—"} líneas BCL
                </span>
              ) : null}
            </div>
            {casos.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onCasoChange(null)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    casoActivo == null
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Todos
                </button>
                {casos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={
                      c.indice_gs != null
                        ? `Índice ${c.indice_gs.toLocaleString("es-PY")} Gs · ${c.lineas_count ?? c.lineas.length} líneas`
                        : undefined
                    }
                    onClick={() => onCasoChange(casoActivo === c.nombre_caso ? null : c.nombre_caso)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      casoActivo === c.nombre_caso
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    }`}
                  >
                    {c.nombre_caso}
                    <span className="ml-1 opacity-70">({c.lineas_count ?? c.lineas.length})</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Link
            href={motorHref}
            className="shrink-0 rounded-lg border border-rimec-azul/30 bg-white px-3 py-2 text-xs font-bold text-rimec-azul hover:bg-rimec-azul/5"
          >
            Abrir biblioteca →
          </Link>
        </div>
        {loading ? <p className="mt-2 text-xs text-gray-500">Cargando casos…</p> : null}
        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      </div>
    </div>
  );
}
