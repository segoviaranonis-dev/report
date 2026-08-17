"use client";

import { useMemo, useState } from "react";
import type { PilaresMaestras, TipoV2Id } from "@/lib/pilares/types";
import type { LrCabeceraState } from "@/lib/pilares/lr-cascada-molecula";
import { PilaresLineaSearchInput } from "./PilaresLineaSearchInput";

const NO_CAMBIAR = "none";

interface LineaReferenciaEditorProps {
  tipoV2Id: TipoV2Id;
  maestras: PilaresMaestras;
  filterState: LrCabeceraState;
  filtroActivo: boolean;
  totalFiltrado: number;
  onApplied: () => Promise<void>;
}

export function LineaReferenciaEditor({
  tipoV2Id,
  maestras,
  filterState,
  filtroActivo,
  totalFiltrado,
  onApplied,
}: LineaReferenciaEditorProps) {
  const [modo, setModo] = useState<"filtro" | "rango">("filtro");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [generoId, setGeneroId] = useState(NO_CAMBIAR);
  const [estiloId, setEstiloId] = useState(NO_CAMBIAR);
  const [tipo1Id, setTipo1Id] = useState(NO_CAMBIAR);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resumenFiltro = useMemo(() => {
    const bits: string[] = [];
    if (filterState.origen_tipo !== "TODOS") bits.push(filterState.origen_tipo);
    if (filterState.marca_ids.length) bits.push(`${filterState.marca_ids.length} marca(s)`);
    if (filterState.estilo_ids.length) bits.push(`${filterState.estilo_ids.length} estilo(s)`);
    if (filterState.problemas_estilo) bits.push("problemas estilo");
    if (filterState.linea_ids.length) bits.push(`${filterState.linea_ids.length} línea(s)`);
    if (filterState.tipo_grupos.length) bits.push(`tipo: ${filterState.tipo_grupos.join(",")}`);
    if (filterState.buscar.trim()) bits.push(`q=${filterState.buscar.trim()}`);
    return bits.length ? bits.join(" · ") : "sin filtros (todo el proveedor)";
  }, [filterState]);

  const apply = async () => {
    setError(null);
    setSuccess(null);
    if (generoId === NO_CAMBIAR && estiloId === NO_CAMBIAR && tipo1Id === NO_CAMBIAR) {
      setError("Seleccioná al menos Género, Estilo o Tipo 1.");
      return;
    }

    if (modo === "rango") {
      const d = desde.trim();
      const h = hasta.trim();
      if (!d || !h) {
        setError("Indicá línea inicial y final.");
        return;
      }
      if (d > h) {
        setError("Línea inicial debe ser ≤ línea final.");
        return;
      }
    } else if (!filtroActivo && totalFiltrado > 5000) {
      setError("Sin filtros el alcance es enorme. Acotá filtros o usá modo Rango.");
      return;
    }

    setApplying(true);
    try {
      const body: Record<string, unknown> = {
        tipo_v2_id: tipoV2Id,
      };
      if (generoId !== NO_CAMBIAR) body.genero_id = Number(generoId);
      if (estiloId !== NO_CAMBIAR) body.grupo_estilo_id = Number(estiloId);
      if (tipo1Id !== NO_CAMBIAR) body.tipo_1_id = Number(tipo1Id);

      if (modo === "rango") {
        body.rango = true;
        body.desde = desde.trim();
        body.hasta = hasta.trim();
      } else {
        body.scope = true;
        body.origen_tipo = filterState.origen_tipo;
        body.deposito_codigo = filterState.deposito_codigo || undefined;
        body.q = filterState.buscar || undefined;
        body.genero_ids = filterState.genero_ids;
        body.marca_ids = filterState.marca_ids;
        body.tipo_1_ids = filterState.tipo_1_ids;
        body.tipo_grupos = filterState.tipo_grupos;
        body.estilo_ids = filterState.problemas_estilo
          ? undefined
          : filterState.estilo_null
            ? "__null__"
            : filterState.estilo_ids;
        body.problemas_estilo = filterState.problemas_estilo ? 1 : undefined;
        body.con_imagen = filterState.con_imagen || undefined;
        body.linea_ids = filterState.linea_ids;
        body.referencia_ids = filterState.referencia_ids;
        body.material_familias = filterState.material_familias;
        body.color_familias = filterState.color_familias;
      }

      const res = await fetch("/api/pilares/linea-referencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error("Sesión expirada o acceso denegado — recargá e iniciá sesión RIMEC Admin.");
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo aplicar");

      const parts: string[] = [];
      if (data.lineas_updated) parts.push(`${data.lineas_updated} líneas (género)`);
      if (data.lr_updated) parts.push(`${data.lr_updated} pares L×R (estilo/tipo 1)`);
      if (data.scope) parts.push(`alcance: ${data.scope}`);
      setSuccess(parts.length ? parts.join(" · ") : "Sin filas en ese alcance.");
      await onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  };

  return (
    <details className="rounded-xl border border-rimec-azul/25 bg-card-bg shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none sm:px-5">
        <span className="font-serif text-base font-semibold text-rimec-azul-dark sm:text-lg">
          Editor masivo
        </span>
        <span className="ml-2 text-xs font-normal text-neutral-500 sm:text-sm">
          Filtro activo o rango de líneas
        </span>
      </summary>

      <div className="space-y-4 border-t border-rimec-azul/10 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModo("filtro")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              modo === "filtro"
                ? "bg-rimec-azul text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            Aplicar a filtro ({totalFiltrado.toLocaleString("es-PY")})
          </button>
          <button
            type="button"
            onClick={() => setModo("rango")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              modo === "rango"
                ? "bg-rimec-azul text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            Por rango de línea
          </button>
        </div>

        {modo === "filtro" ? (
          <p className="text-xs text-neutral-600">
            Mutará la <strong>maestra</strong>{" "}
            <code className="text-[10px]">linea</code> /{" "}
            <code className="text-[10px]">linea_referencia</code> del universo filtrado (
            <strong>{resumenFiltro}</strong>). Esas FKs alimentan filtros Web · AM · PE — no el
            staging SDRM.
          </p>
        ) : (
          <p className="text-xs text-neutral-600">
            Ej.: <strong>1122</strong>–<strong>1184</strong>. Género →{" "}
            <code className="text-[10px]">linea</code>; estilo/tipo 1 →{" "}
            <code className="text-[10px]">linea_referencia</code> (maestra → FK filtros).
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modo === "rango" ? (
            <>
              <PilaresLineaSearchInput
                tipoV2Id={tipoV2Id}
                label="Línea inicial"
                value={desde}
                onChange={setDesde}
                placeholder="1122"
              />
              <PilaresLineaSearchInput
                tipoV2Id={tipoV2Id}
                label="Línea final"
                value={hasta}
                onChange={setHasta}
                placeholder="1184"
              />
            </>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Género</span>
            <select
              value={generoId}
              onChange={(e) => setGeneroId(e.target.value)}
              className="w-full rounded-lg border border-report-rule px-3 py-2 text-sm"
            >
              <option value={NO_CAMBIAR}>— No cambiar —</option>
              {maestras.generos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Estilo</span>
            <select
              value={estiloId}
              onChange={(e) => setEstiloId(e.target.value)}
              className="w-full rounded-lg border border-report-rule px-3 py-2 text-sm"
            >
              <option value={NO_CAMBIAR}>— No cambiar —</option>
              {maestras.estilos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Tipo 1</span>
            <select
              value={tipo1Id}
              onChange={(e) => setTipo1Id(e.target.value)}
              className="w-full rounded-lg border border-report-rule px-3 py-2 text-sm"
            >
              <option value={NO_CAMBIAR}>— No cambiar —</option>
              {maestras.tipos1.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={applying}
            onClick={apply}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {applying ? "Aplicando…" : modo === "filtro" ? "Aplicar a filtro" : "Aplicar rango"}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm font-medium text-green-800">{success}</p>}
        </div>
      </div>
    </details>
  );
}
