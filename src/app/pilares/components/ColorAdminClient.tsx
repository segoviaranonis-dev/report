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
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import { ImagenAmpliadaOverlay } from "@/components/stock-pronta-entrega/ImagenAmpliadaOverlay";
import { productImageCandidatesForRow } from "@/lib/retail/product-image";

/** Orden Director: sin tono/sin foto → sin tono/con foto → con tono/sin foto → con tono/con foto */
function sortColoresTrabajo(rows: ColorRow[]): ColorRow[] {
  const rank = (r: ColorRow) => {
    const sinTono = !parseTonoCanon(r.tono_canon);
    const conImg = Boolean(
      r.thumb?.linea_codigo ||
        (typeof r.thumb?.imagen_nombre === "string" && r.thumb.imagen_nombre.trim()),
    );
    if (sinTono && !conImg) return 1;
    if (sinTono && conImg) return 2;
    if (!sinTono && !conImg) return 3;
    return 4;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return String(a.codigo_proveedor).localeCompare(String(b.codigo_proveedor), undefined, {
      numeric: true,
    });
  });
}

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
  /** `pred:<texto>` o `id:<n>` — evita bloquear todas las filas sin nombre. */
  const [savingKey, setSavingKey] = useState<string | null>(null);
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
      const base = new URLSearchParams({ tipo_v2_id: String(tipoV2Id), limit: "500" });
      if (q.trim()) base.set("q", q.trim());
      applyFiltersToParams(base, filters);

      // 1) Grilla rápida sin thumbs (reacción inmediata)
      const pFast = new URLSearchParams(base);
      pFast.set("thumbs", "0");
      const r = await fetch(`/api/pilares/color?${pFast}`);
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
      const loadedRows = sortColoresTrabajo(data.rows ?? []);
      setRows(loadedRows);
      setTotal(data.total ?? 0);
      setResumen(data.resumen ?? null);
      setCatalog(Array.isArray(data.estandar) && data.estandar.length ? data.estandar : COLORES_ESTANDAR_DEFAULT);
      setLoading(false);

      // 2) Hidratar miniaturas (endpoint liviano — solo retail por color_code)
      const codes = loadedRows.map((row) => String(row.codigo_proveedor).trim()).filter(Boolean);
      if (!codes.length) return;
      const r2 = await fetch("/api/pilares/color/thumbs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_v2_id: tipoV2Id, codes }),
      });
      if (!r2.ok) return;
      const data2 = await readJsonResponse<{ thumbs?: Record<string, ColorRow["thumb"]> }>(r2);
      const map = data2.thumbs ?? {};
      setRows((prev) =>
        sortColoresTrabajo(
          prev.map((row) => {
            const key = String(row.codigo_proveedor).trim();
            return key in map ? { ...row, thumb: map[key] ?? null } : row;
          }),
        ),
      );
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
    const pred = row.predominante?.trim() ?? "";
    const predKey = pred.toLowerCase();
    const key = predKey ? `pred:${predKey}` : `id:${row.id}`;
    const tono = std ? (estandarToTono(std) as Record<string, unknown>) : null;
    const nombreProv = std && !row.nombre?.trim() ? std.etiqueta.trim().toUpperCase() : null;
    const prevEtiqueta =
      parseTonoCanon(row.tono_canon)?.etiqueta?.trim().toLowerCase() ?? "";
    const nextEtiqueta = std?.etiqueta?.trim().toLowerCase() ?? "";

    setSavingKey(key);
    setError(null);

    // UI inmediata — tono_canon en BD es la ley (RIMEC Web / Tablet leen color.tono_canon)
    setRows((prev) => {
      const mapped = prev.map((r) => {
        const match = predKey
          ? r.predominante.trim().toLowerCase() === predKey
          : r.id === row.id;
        if (!match) return r;
        const nextNombre = !r.nombre?.trim() && nombreProv ? nombreProv : r.nombre;
        return {
          ...r,
          tono_canon: tono,
          nombre: nextNombre,
          predominante: nextNombre ? nextNombre.split(/[/,\-–|\s]+/)[0] ?? nextNombre : r.predominante,
        };
      });
      let next = mapped;
      if (filters.sinTono && tono) {
        next = mapped.filter((r) => {
          const match = predKey
            ? r.predominante.trim().toLowerCase() === predKey
            : r.id === row.id;
          return !match;
        });
      } else if (filters.conTono && !tono) {
        next = mapped.filter((r) => {
          const match = predKey
            ? r.predominante.trim().toLowerCase() === predKey
            : r.id === row.id;
          return !match;
        });
      }
      return sortColoresTrabajo(next);
    });
    setResumen((prev) => {
      if (!prev) return prev;
      const delta = predKey
        ? rows.filter((r) => r.predominante.trim().toLowerCase() === predKey).length || 1
        : 1;
      const hadTono = Boolean(row.tono_canon);
      const hasTono = Boolean(tono);
      let sin_tono = prev.sin_tono;
      let con_tono = prev.con_tono;
      if (!hadTono && hasTono) {
        sin_tono = Math.max(0, sin_tono - delta);
        con_tono += delta;
      } else if (hadTono && !hasTono) {
        con_tono = Math.max(0, con_tono - delta);
        sin_tono += delta;
      }
      const por_etiqueta = prev.por_etiqueta.map((e) => {
        let count = e.count;
        if (prevEtiqueta && e.etiqueta.trim().toLowerCase() === prevEtiqueta) {
          count = Math.max(0, count - delta);
        }
        if (nextEtiqueta && e.etiqueta.trim().toLowerCase() === nextEtiqueta) {
          count += delta;
        }
        return { ...e, count };
      });
      if (nextEtiqueta && !por_etiqueta.some((e) => e.etiqueta.trim().toLowerCase() === nextEtiqueta)) {
        por_etiqueta.push({ etiqueta: std!.etiqueta, count: delta });
      }
      return { ...prev, sin_tono, con_tono, por_etiqueta };
    });
    if (std) {
      setCatalog((prev) =>
        prev.map((c) =>
          c.etiqueta === std.etiqueta
            ? { ...c, uso_count: (c.uso_count ?? 0) + (predKey ? Math.max(1, rows.filter((r) => r.predominante.trim().toLowerCase() === predKey).length) : 1) }
            : prevEtiqueta && c.etiqueta.trim().toLowerCase() === prevEtiqueta
              ? { ...c, uso_count: Math.max(0, (c.uso_count ?? 0) - 1) }
              : c,
        ),
      );
    }

    try {
      const body: Record<string, unknown> = { tipo_v2_id: tipoV2Id };
      if (pred) {
        body.sync_predominante = true;
        body.predominante = pred;
      } else {
        body.id = row.id;
        if (nombreProv) body.nombre = nombreProv;
      }
      if (std) body.tono_canon = tono;
      else body.clear_tono = true;

      const res = await fetch("/api/pilares/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string; updated?: number }>(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      await load();
    } finally {
      setSavingKey(null);
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
          <span className="mt-1 block text-xs text-neutral-500">
            Proveedor aislado: {tipoV2Id === 1 ? "654 calzado (L-R-M-C)" : "638 Kyly (L_C / excel color)"} · no
            se mezclan bolsas. Orden: 1) sin tono · sin foto → 2) sin tono · con foto → 3) con tono · sin foto →
            4) con tono · con foto
          </span>
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
                <th className="px-3 py-3" title="1ª foto retail con este color_code exacto">
                  Vista
                </th>
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
                  tipoV2Id={tipoV2Id}
                  saving={
                    savingKey != null &&
                    (row.predominante.trim()
                      ? savingKey === `pred:${row.predominante.trim().toLowerCase()}`
                      : savingKey === `id:${row.id}`)
                  }
                  onApply={(std) => applyByPredominante(row, std)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
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
  tipoV2Id,
  saving,
  onApply,
}: {
  row: ColorRow;
  catalog: ColorEstandar[];
  tipoV2Id: 1 | 2;
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
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const imgCtx = {
    tipoV2Id,
    imagenColorExcel: row.thumb?.excel_color_code ?? null,
  };
  const colorForStem =
    row.thumb?.excel_color_code?.trim() ||
    row.thumb?.color_code ||
    row.codigo_proveedor;

  const thumbCandidates = row.thumb?.linea_codigo
    ? productImageCandidatesForRow(
        row.thumb.linea_codigo,
        row.thumb.referencia_codigo,
        row.thumb.material_code ?? "",
        colorForStem,
        row.thumb.imagen_nombre,
        "thumb",
        imgCtx,
      )
    : [];
  const heroCandidates = row.thumb?.linea_codigo
    ? productImageCandidatesForRow(
        row.thumb.linea_codigo,
        row.thumb.referencia_codigo,
        row.thumb.material_code ?? "",
        colorForStem,
        row.thumb.imagen_nombre,
        "hero",
        imgCtx,
      )
    : [];

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
      <td className="max-w-xs px-3 py-2 text-neutral-600">
        {row.nombre?.trim() ? (
          <span className="truncate block" title={row.nombre}>
            {row.nombre}
          </span>
        ) : (
          <div className="space-y-0.5">
            <span className="text-amber-800 text-xs font-semibold">ciego (sin nombre proveedor)</span>
            {row.thumb?.linea_codigo ? (
              <div
                className="font-mono text-[10px] text-rimec-azul"
                title="Artículo retail · 1ª coincidencia color_code"
              >
                {row.thumb.linea_codigo}-{row.thumb.referencia_codigo}-
                {row.thumb.material_code || "?"}-{row.thumb.color_code || row.codigo_proveedor}
              </div>
            ) : (
              <div className="text-[10px] text-neutral-400">sin artículo retail</div>
            )}
          </div>
        )}
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
          {/* Solo si AÚN no hay tono — no confundir con falta de nombre */}
          {sinAsignar && !row.predominante && row.thumb?.linea_codigo && (
            <span className="text-[10px] text-rimec-azul">asigná tono → completa nombre</span>
          )}
          {!sinAsignar && !row.nombre?.trim() && (
            <span className="text-[10px] text-amber-700">tono OK · falta nombre proveedor</span>
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
      <td className="px-2 py-2">
        {row.thumb?.linea_codigo ? (
          <div
            title={`Clic para ampliar · ${row.thumb.linea_codigo}-${row.thumb.referencia_codigo}-${row.thumb.material_code}-${row.thumb.color_code}`}
          >
            <ProductThumbFrame
              alt={`color ${row.codigo_proveedor}`}
              candidates={thumbCandidates}
              size={80}
              onClick={() => setZoomSrc(heroCandidates[0] ?? thumbCandidates[0] ?? null)}
            />
          </div>
        ) : (
          <span
            className="inline-flex h-20 w-20 items-center justify-center rounded border border-dashed border-neutral-300 text-[9px] text-neutral-400"
            title="Sin foto retail con este color_code"
          >
            sin foto
          </span>
        )}
        <ImagenAmpliadaOverlay
          src={zoomSrc}
          alt={`color ${row.codigo_proveedor}`}
          onClose={() => setZoomSrc(null)}
        />
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