"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColorRow, ColoresResumen } from "@/lib/pilares/types";
import {
  COLORES_ESTANDAR_DEFAULT,
  estandarToTono,
  findColorEstandarInCatalog,
  sugerirColorEstandarFromCatalog,
  OTROS_MULTICOLOR_SWATCHES,
  SIN_TONO_ETIQUETA,
  type ColorEstandar,
} from "@/lib/pilares/colores-estandar";
import { parseTonoCanon, tonoCircleStyle, tonoPaleta } from "@/lib/pilares/color-canon";
import { readJsonResponse } from "@/lib/fetch-json";
import { ColorEditor } from "./ColorEditor";
import { ColorImportPanel } from "./ColorImportPanel";
import { DatosGeneralesColor, type ColorAdminFilterKey } from "./DatosGeneralesColor";
import { ColorSwatchButton, PaletaColoresEstandar } from "./PaletaColoresEstandar";
import { TipoV2Selector, useTipoV2FromUrl } from "./TipoV2Selector";

export type ColorAdminFilters = {
  sinNombre: boolean;
  conNombre: boolean;
  sinTono: boolean;
  conTono: boolean;
  /** Multiselect OR — tono_canon.etiqueta */
  etiquetas: string[];
};

const EMPTY_FILTERS: ColorAdminFilters = {
  sinNombre: false,
  conNombre: false,
  sinTono: false,
  conTono: false,
  etiquetas: [],
};

function applyFiltersToParams(p: URLSearchParams, f: ColorAdminFilters): void {
  if (f.sinNombre) p.set("sin_nombre", "1");
  if (f.conNombre) p.set("con_nombre", "1");
  if (f.sinTono) p.set("sin_tono", "1");
  if (f.conTono) p.set("con_tono", "1");
  if (f.etiquetas.length) p.set("etiquetas", f.etiquetas.join(","));
}

function toggleFilterKey(prev: ColorAdminFilters, key: ColorAdminFilterKey): ColorAdminFilters {
  const next = { ...prev, etiquetas: [...prev.etiquetas] };
  switch (key) {
    case "sinNombre":
      next.sinNombre = !prev.sinNombre;
      if (next.sinNombre) next.conNombre = false;
      break;
    case "conNombre":
      next.conNombre = !prev.conNombre;
      if (next.conNombre) next.sinNombre = false;
      break;
    case "sinTono":
      next.sinTono = !prev.sinTono;
      if (next.sinTono) {
        next.conTono = false;
        next.etiquetas = [];
      }
      break;
    case "conTono":
      next.conTono = !prev.conTono;
      if (next.conTono) {
        next.sinTono = false;
        next.etiquetas = [];
      }
      break;
  }
  return next;
}

function toggleEtiquetaKey(prev: ColorAdminFilters, etiqueta: string): ColorAdminFilters {
  const norm = etiqueta.trim();
  if (!norm) return prev;
  const has = prev.etiquetas.some((e) => e.toLowerCase() === norm.toLowerCase());
  const etiquetas = has
    ? prev.etiquetas.filter((e) => e.toLowerCase() !== norm.toLowerCase())
    : [...prev.etiquetas, norm];
  return { ...prev, etiquetas, sinTono: false, conTono: false };
}

function filterSummary(f: ColorAdminFilters): string {
  const parts: string[] = [];
  if (f.sinNombre) parts.push("sin descripción");
  if (f.conNombre) parts.push("con descripción");
  if (f.sinTono) parts.push("sin tono_canon");
  if (f.conTono) parts.push("con tono_canon");
  if (f.etiquetas.length) parts.push(`etiquetas: ${f.etiquetas.join(" + ")}`);
  return parts.length ? parts.join(" · ") : "ninguno";
}

export function ColorAdminClient() {
  const tipoV2Id = useTipoV2FromUrl();
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ColorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ColoresResumen | null>(null);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<ColorAdminFilters>(EMPTY_FILTERS);
  const [savingPredominante, setSavingPredominante] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);

  const hasActiveFilters = useMemo(
    () =>
      filters.sinNombre ||
      filters.conNombre ||
      filters.sinTono ||
      filters.conTono ||
      filters.etiquetas.length > 0 ||
      Boolean(q.trim()),
    [filters, q],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tipo_v2_id: String(tipoV2Id), limit: "500" });
      if (q.trim()) p.set("q", q.trim());
      applyFiltersToParams(p, filters);

      const r = await fetch(`/api/pilares/color?${p}`);
      const data = await readJsonResponse<{
        configured?: boolean;
        error?: string;
        rows?: ColorRow[];
        total?: number;
        resumen?: ColoresResumen | null;
        estandar?: ColorEstandar[];
      }>(r);
      if (!r.ok) throw new Error(data.error || "Error al cargar color");
      if (data.configured === false) {
        setConfigured(false);
        setRows([]);
        setTotal(0);
        return;
      }
      setConfigured(true);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setResumen(data.resumen ?? null);
      setCatalog(Array.isArray(data.estandar) && data.estandar.length ? data.estandar : COLORES_ESTANDAR_DEFAULT);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tipoV2Id, q, filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setQ("");
    setFilters(EMPTY_FILTERS);
  }, [tipoV2Id]);

  const applyByPredominante = async (row: ColorRow, std: ColorEstandar | null) => {
    const pred = row.predominante?.trim();
    if (!pred) {
      setError("Sin predominante — no se puede sincronizar el lote.");
      return;
    }

    setSavingPredominante(pred.toLowerCase());
    setError(null);
    try {
      const body: Record<string, unknown> = {
        tipo_v2_id: tipoV2Id,
        sync_predominante: true,
        predominante: pred,
      };
      if (std) {
        body.tono_canon = estandarToTono(std);
      } else {
        body.clear_tono = true;
      }

      const res = await fetch("/api/pilares/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string; updated?: number }>(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingPredominante(null);
    }
  };

  const toggleFilter = (key: ColorAdminFilterKey) => {
    setFilters((prev) => toggleFilterKey(prev, key));
  };

  const toggleEtiqueta = (etiqueta: string) => {
    setFilters((prev) => toggleEtiquetaKey(prev, etiqueta));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQ("");
  };

  if (!configured) {
    return (
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-amber-900">
        DATABASE_URL no configurada en el servidor.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/pilares" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Pilares
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Administrador de Color</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Descripción proveedor (<code className="text-xs">nombre</code>) puede venir en español, portugués o inglés —
          se guarda tal cual. Filtros operativos usan <strong>tono_canon</strong> en español (Negro, Beige, Gris…).
          Al elegir etiqueta en una fila, <strong>todos los códigos con el mismo predominante</strong> se guardan solos.
          <strong> Otros</strong> (multicolor) solo manual — nunca auto-asignado.
        </p>
      </div>

      <TipoV2Selector syncUrl className="mb-6" />

      <ColorImportPanel tipoV2Id={tipoV2Id} onDone={load} />

      <ColorEditor tipoV2Id={tipoV2Id} catalog={catalog} onApplied={load} />

      <DatosGeneralesColor
        resumen={resumen}
        totalFiltrado={total}
        filasMostradas={rows.length}
        filters={filters}
        loading={loading}
        onToggleFilter={toggleFilter}
        onToggleEtiqueta={toggleEtiqueta}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-bold uppercase text-neutral-500">Buscar</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="código, nombre o etiqueta…"
            className="mt-1 block w-72 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-600 hover:border-red-300 hover:text-red-600"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {!loading && hasActiveFilters && (
        <p className="mb-3 text-xs font-medium text-rimec-azul">
          Filtros activos: {filterSummary(filters)}
          {q.trim() ? ` · búsqueda «${q.trim()}»` : ""}
        </p>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      {!loading && (
        <p className="mb-3 text-sm text-neutral-600">
          Grilla: {rows.length} filas mostradas
          {total > rows.length ? ` (de ${total.toLocaleString("es-PY")} filtradas)` : ""}
          {resumen && total !== resumen.total && (
            <> · universo {resumen.total.toLocaleString("es-PY")}</>
          )}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-600">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rimec-azul/20 bg-card-bg shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-rimec-azul/15 bg-rimec-celeste-bg/40 text-xs uppercase tracking-wide text-rimec-azul-dark">
              <tr>
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3">Nombre proveedor</th>
                <th className="px-3 py-3">Predominante</th>
                <th className="px-3 py-3">Etiqueta filtro</th>
                <th className="px-3 py-3">Tono</th>
                <th className="px-3 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ColorRowEditor
                  key={row.id}
                  row={row}
                  catalog={catalog}
                  saving={
                    savingPredominante != null &&
                    row.predominante.trim().toLowerCase() === savingPredominante
                  }
                  onApply={(std) => applyByPredominante(row, std)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    Sin colores para este proveedor / filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ColorRowEditor({
  row,
  catalog,
  saving,
  onApply,
}: {
  row: ColorRow;
  catalog: ColorEstandar[];
  saving: boolean;
  onApply: (std: ColorEstandar | null) => void;
}) {
  const tono = parseTonoCanon(row.tono_canon);
  const stdFromTono = tono ? findColorEstandarInCatalog(tono.etiqueta, catalog) : null;
  const sugerido = sugerirColorEstandarFromCatalog(row.nombre ?? row.predominante, catalog);
  const etiqueta = tono?.etiqueta?.trim() ?? SIN_TONO_ETIQUETA;
  const hex =
    tono?.tipo === "solido"
      ? tono.hex
      : stdFromTono?.hex ?? findColorEstandarInCatalog(etiqueta, catalog)?.hex ?? "";
  const sinAsignar = !tono;
  const [paletteRect, setPaletteRect] = useState<DOMRect | null>(null);

  const stdSelected = etiqueta ? findColorEstandarInCatalog(etiqueta, catalog) : undefined;
  const swatchStyle =
    tono?.tipo === "paleta"
      ? tonoCircleStyle(tono)
      : stdSelected?.multicolor
        ? tonoCircleStyle(
            tonoPaleta(stdSelected.etiqueta, stdSelected.swatches ?? OTROS_MULTICOLOR_SWATCHES),
          )
        : hex
          ? { backgroundColor: hex }
          : undefined;

  const onEtiquetaSelect = (value: string) => {
    if (!value) {
      onApply(null);
      return;
    }
    const std = findColorEstandarInCatalog(value, catalog);
    if (std) onApply(std);
  };

  const applyEstandar = (c: ColorEstandar) => {
    onApply(c);
    setPaletteRect(null);
  };

  return (
    <tr className={`border-b border-neutral-100 hover:bg-rimec-celeste-bg/20 ${sinAsignar ? "bg-neutral-50/80" : ""}`}>
      <td className="px-3 py-2 font-mono font-semibold">{row.codigo_proveedor}</td>
      <td className="max-w-xs truncate px-3 py-2 text-neutral-600" title={row.nombre ?? ""}>
        {row.nombre ?? "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-neutral-500">{row.predominante || "—"}</span>
          {sugerido && (
            <span className="rounded bg-rimec-celeste-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-rimec-azul">
              → {sugerido.etiqueta}
            </span>
          )}
          {!sugerido && row.predominante && (
            <span className="text-[10px] text-amber-700">sin match — paleta</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <select
          value={etiqueta}
          onChange={(e) => onEtiquetaSelect(e.target.value)}
          disabled={saving}
          className="w-36 rounded border border-neutral-200 px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="">— sin tono —</option>
          {catalog.map((c) => (
            <option key={c.etiqueta} value={c.etiqueta}>
              {c.etiqueta}
              {c.uso_count != null ? ` (${c.uso_count})` : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <ColorSwatchButton
            hex={hex}
            etiqueta={etiqueta}
            empty={sinAsignar}
            swatchStyle={swatchStyle}
            onOpenPalette={setPaletteRect}
          />
          <span className="font-mono text-[10px] text-neutral-400">{hex || "—"}</span>
        </div>
        <PaletaColoresEstandar
          open={Boolean(paletteRect)}
          catalog={catalog}
          anchorRect={paletteRect}
          selectedEtiqueta={etiqueta}
          onSelect={applyEstandar}
          onClose={() => setPaletteRect(null)}
        />
      </td>
      <td className="px-3 py-2">
        {saving ? (
          <span className="text-xs text-neutral-500">Guardando…</span>
        ) : tono ? (
          <button
            type="button"
            onClick={() => onApply(null)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-red-300 hover:text-red-600"
            title={`Quitar tono de todos «${row.predominante}»`}
          >
            ✕
          </button>
        ) : null}
      </td>
    </tr>
  );
}