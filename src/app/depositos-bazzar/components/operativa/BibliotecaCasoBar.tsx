"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** PE: candado BCL en BD — `/api/stock-pronta-entrega/vincular-biblioteca` */
  vincularBibliotecaPath?: string;
  batchLabel?: string;
  bibliotecaId: number | null;
  casoActivo: string | null;
  onBibliotecaChange: (id: number | null) => void;
  onCasoChange: (nombre: string | null) => void;
  onCasosLoaded: (casos: CasoBibliotecaLite[]) => void;
  onVinculado?: (payload: {
    actualizados: number;
    promocionales: number;
    biblioteca_nombre: string;
  }) => void;
};

export function BibliotecaCasoBar({
  clienteId,
  categoria = "tienda",
  indiceApiPath,
  vincularBibliotecaPath,
  batchLabel,
  bibliotecaId,
  casoActivo,
  onBibliotecaChange,
  onCasoChange,
  onCasosLoaded,
  onVinculado,
}: Props) {
  const [bibliotecas, setBibliotecas] = useState<BibliotecaRow[]>([]);
  const [casos, setCasos] = useState<CasoBibliotecaLite[]>([]);
  const [bibliotecaActiva, setBibliotecaActiva] = useState<BibliotecaRow | null>(null);
  const [lineasBcl, setLineasBcl] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [vinculoMsg, setVinculoMsg] = useState<string | null>(null);
  const [bibVinculadaId, setBibVinculadaId] = useState<number | null>(null);
  const [bibVinculadaNombre, setBibVinculadaNombre] = useState<string | null>(null);
  /** Evita botón muerto cuando el padre aún no sincronizó bibliotecaId */
  const [selectedBibId, setSelectedBibId] = useState<number | null>(bibliotecaId);
  const userPickedBibRef = useRef(false);

  const batchNorm = batchLabel?.trim().toLowerCase() || null;
  const batchQuery =
    batchNorm && batchNorm !== "—" ? `?batch=${encodeURIComponent(batchNorm)}` : "";

  useEffect(() => {
    userPickedBibRef.current = false;
  }, [batchQuery]);

  useEffect(() => {
    if (bibliotecaId != null && !userPickedBibRef.current) setSelectedBibId(bibliotecaId);
  }, [bibliotecaId]);

  const bibParaVincular = selectedBibId ?? bibliotecaId ?? bibliotecaActiva?.id ?? null;

  const cargarVinculo = useCallback(async () => {
    if (!vincularBibliotecaPath) return null;
    const r = await fetch(`${vincularBibliotecaPath}${batchQuery}`, {
      cache: "no-store",
      credentials: "include",
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      const apiErr =
        typeof j.error === "string"
          ? j.error
          : r.status === 403
            ? "RIMEC Admin requerido (rol_id=1)"
            : r.status === 401
              ? "Sesión expirada — volvé a iniciar sesión"
              : null;
      throw new Error(apiErr ?? "No se pudo leer candado biblioteca PE");
    }
    const id = j.biblioteca_id != null ? Number(j.biblioteca_id) : null;
    setBibVinculadaId(id);
    setBibVinculadaNombre(typeof j.biblioteca_nombre === "string" ? j.biblioteca_nombre : null);
    return id;
  }, [batchQuery, vincularBibliotecaPath]);

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

    const listaUrl = `${indiceBase}?proveedor_id=${PROVEEDOR_CALZADO}${catParam}`;
    const vinculoUrl = vincularBibliotecaPath ? `${vincularBibliotecaPath}${batchQuery}` : null;

    Promise.all([
      fetch(listaUrl, { cache: "no-store", credentials: "include" }).then((r) => r.json()),
      vinculoUrl
        ? fetch(vinculoUrl, { cache: "no-store", credentials: "include" }).then((r) => r.json())
        : Promise.resolve(null),
    ])
      .then(async ([j, vinculo]) => {
        if (cancelled) return;
        if (j.error) {
          setErr(j.error);
          return;
        }

        const lista = (j.bibliotecas ?? []) as BibliotecaRow[];
        setBibliotecas(lista);

        const canonica =
          (j.canonica as BibliotecaRow | null) ?? lista.find((b) => b.canonica) ?? lista[0] ?? null;

        let candadoId: number | null = null;
        let candadoNombre: string | null = null;
        if (vinculo && vinculo.ok && vinculo.biblioteca_id != null) {
          candadoId = Number(vinculo.biblioteca_id);
          candadoNombre =
            typeof vinculo.biblioteca_nombre === "string" ? vinculo.biblioteca_nombre : null;
          setBibVinculadaId(candadoId);
          setBibVinculadaNombre(candadoNombre);
        }

        if (userPickedBibRef.current) return;

        const id = candadoId ?? bibliotecaId ?? canonica?.id ?? null;

        if (id != null) {
          setSelectedBibId(id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap candado BD > canónica
  }, [indiceBase, categoria, batchQuery, vincularBibliotecaPath]);

  useEffect(() => {
    if (!vincularBibliotecaPath) return;
    void cargarVinculo().catch(() => {});
  }, [cargarVinculo, vincularBibliotecaPath, batchQuery]);

  async function vincularBibliotecaEnBd() {
    const bibId = bibParaVincular;
    if (!vincularBibliotecaPath || bibId == null) {
      setErr("Elegí una biblioteca antes de vincular");
      return;
    }
    setVinculando(true);
    setVinculoMsg(null);
    setErr(null);
    try {
      const r = await fetch(vincularBibliotecaPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          biblioteca_id: bibId,
          batch: batchNorm && batchNorm !== "—" ? batchNorm : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        const apiErr =
          typeof j.error === "string"
            ? j.error
            : r.status === 403
              ? "RIMEC Admin requerido (rol_id=1)"
              : r.status === 401
                ? "Sesión expirada — volvé a iniciar sesión"
                : "No se pudo vincular biblioteca";
        throw new Error(apiErr);
      }

      const lockedId = Number(j.biblioteca_id ?? bibId);
      setSelectedBibId(lockedId);
      onBibliotecaChange(lockedId);
      setBibVinculadaId(lockedId);
      setBibVinculadaNombre(typeof j.biblioteca_nombre === "string" ? j.biblioteca_nombre : null);
      userPickedBibRef.current = false;

      await cargarCasos(lockedId);

      void cargarVinculo().catch(() => {});

      const msg = `Candado OK · biblioteca #${lockedId} · ${j.actualizados ?? 0} filas · ${j.promocionales ?? 0} PROMO`;
      setVinculoMsg(msg);
      onVinculado?.({
        actualizados: Number(j.actualizados ?? 0),
        promocionales: Number(j.promocionales ?? 0),
        biblioteca_nombre: String(j.biblioteca_nombre ?? ""),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al vincular");
    } finally {
      setVinculando(false);
    }
  }

  async function onSelectBiblioteca(id: number) {
    userPickedBibRef.current = true;
    setSelectedBibId(id);
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

  const motorHref = bibParaVincular
    ? `/proceso-importacion/motor-precios/biblioteca/${bibParaVincular}`
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
                value={bibParaVincular ?? ""}
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
          <div className="flex shrink-0 flex-col items-end gap-2">
            {vincularBibliotecaPath ? (
              <button
                type="button"
                disabled={vinculando || bibParaVincular == null}
                onClick={() => void vincularBibliotecaEnBd()}
                className="rounded-lg border-2 border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="Persiste casos BCL en PPD — badge PROMO en RIMEC Web"
              >
                {vinculando ? "Vinculando…" : "Vincular biblioteca"}
              </button>
            ) : null}
            <Link
              href={motorHref}
              className="rounded-lg border border-rimec-azul/30 bg-white px-3 py-2 text-xs font-bold text-rimec-azul hover:bg-rimec-azul/5"
            >
              Abrir biblioteca →
            </Link>
          </div>
        </div>
        {bibVinculadaId != null && bibParaVincular === bibVinculadaId ? (
          <p className="mt-2 text-xs font-semibold text-emerald-700">
            Candado activo en BD · biblioteca #{bibVinculadaId}
            {bibVinculadaNombre ? ` · ${bibVinculadaNombre}` : ""}
          </p>
        ) : bibVinculadaId != null && bibParaVincular !== bibVinculadaId ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            Biblioteca distinta a la vinculada (#{bibVinculadaId}
            {bibVinculadaNombre ? ` · ${bibVinculadaNombre}` : ""}) — pulsar Vincular para actualizar etiquetas
          </p>
        ) : null}
        {vinculoMsg ? <p className="mt-1 text-xs font-semibold text-emerald-800">{vinculoMsg}</p> : null}
        {loading ? <p className="mt-2 text-xs text-gray-500">Cargando casos…</p> : null}
        {err ? (
          <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {err}
          </p>
        ) : null}
      </div>
    </div>
  );
}
