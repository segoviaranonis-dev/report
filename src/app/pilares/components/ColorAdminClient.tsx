"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ColorRow, ColoresResumen } from "@/lib/pilares/types";
import {
  COLORES_ESTANDAR_DEFAULT,
  findColorEstandarInCatalog,
  sugerirColorEstandarFromCatalog,
  SIN_TONO_ETIQUETA,
  type ColorEstandar,
} from "@/lib/pilares/colores-estandar";
import { parseTonoCanon, tonoSolido } from "@/lib/pilares/color-canon";
import { ColorEditor } from "./ColorEditor";
import { DatosGeneralesColor } from "./DatosGeneralesColor";
import { ColorSwatchButton, PaletaColoresEstandar } from "./PaletaColoresEstandar";
import { TipoV2Selector, useTipoV2FromUrl } from "./TipoV2Selector";

export function ColorAdminClient() {
  const tipoV2Id = useTipoV2FromUrl();
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ColorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ColoresResumen | null>(null);
  const [q, setQ] = useState("");
  const [sinTono, setSinTono] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, { etiqueta: string; hex: string }>>({});
  const [catalog, setCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tipo_v2_id: String(tipoV2Id), limit: "500" });
      if (q.trim()) p.set("q", q.trim());
      if (sinTono) p.set("sin_tono", "1");

      const r = await fetch(`/api/pilares/color?${p}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al cargar color");
      if (data.configured === false) {
        setConfigured(false);
        setRows([]);
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
    } finally {
      setLoading(false);
    }
  }, [tipoV2Id, q, sinTono]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setQ("");
    setSinTono(false);
    setDraft({});
  }, [tipoV2Id]);

  const saveRow = async (row: ColorRow) => {
    const tono = parseTonoCanon(row.tono_canon);
    const d = draft[row.id];
    if (d?.etiqueta === "") {
      if (tono) await clearTono(row);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }

    const sugerido = sugerirColorEstandarFromCatalog(row.nombre ?? row.predominante, catalog);
    const etiqueta =
      d?.etiqueta?.trim() ||
      (!tono && !d && sugerido ? sugerido.etiqueta : "");
    if (!etiqueta) return;

    setSavingId(row.id);
    setError(null);
    try {
      const std = findColorEstandarInCatalog(etiqueta, catalog);
      if (!std) throw new Error("Elegí un color estándar de la lista");
      const res = await fetch("/api/pilares/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_v2_id: tipoV2Id,
          id: row.id,
          tono_canon: tonoSolido(std.etiqueta, std.hex),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");
      setDraft((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingId(null);
    }
  };

  const clearTono = async (row: ColorRow) => {
    setSavingId(row.id);
    setError(null);
    try {
      const res = await fetch("/api/pilares/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_v2_id: tipoV2Id, id: row.id, clear_tono: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo limpiar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al limpiar");
    } finally {
      setSavingId(null);
    }
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
          Con predominante identificado (ORO, BLANCO…) se pre-asigna el estándar. Sin match (BRONCE, GRAFITO…) queda
          vacío para que elijas en la paleta.
        </p>
      </div>

      <TipoV2Selector syncUrl className="mb-6" />

      <ColorEditor tipoV2Id={tipoV2Id} catalog={catalog} onApplied={load} />

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
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={sinTono} onChange={(e) => setSinTono(e.target.checked)} />
          Solo sin tono_canon
        </label>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      <DatosGeneralesColor
        resumen={resumen}
        totalFiltrado={total}
        filasMostradas={rows.length}
        sinTonoFiltro={sinTono}
        loading={loading}
        onFilterSinTono={() => setSinTono(true)}
        onFilterEtiqueta={(etiqueta) => setQ(etiqueta)}
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      {!loading && (
        <p className="mb-3 text-sm text-neutral-600">
          Grilla: {rows.length} filas mostradas · <strong>{total.toLocaleString("es-PY")}</strong> coinciden con el
          filtro
          {resumen && total !== resumen.total && (
            <> (de {resumen.total.toLocaleString("es-PY")} totales en BD)</>
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
                <th className="px-3 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ColorRowEditor
                  key={row.id}
                  row={row}
                  catalog={catalog}
                  draft={draft[row.id]}
                  saving={savingId === row.id}
                  onDraftChange={(d) =>
                    setDraft((prev) => {
                      if (d === null) {
                        const next = { ...prev };
                        delete next[row.id];
                        return next;
                      }
                      return { ...prev, [row.id]: d };
                    })
                  }
                  onSave={() => saveRow(row)}
                  onClear={() => clearTono(row)}
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
  draft,
  saving,
  onDraftChange,
  onSave,
  onClear,
}: {
  row: ColorRow;
  catalog: ColorEstandar[];
  draft?: { etiqueta: string; hex: string };
  saving: boolean;
  onDraftChange: (d: { etiqueta: string; hex: string } | null) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const tono = parseTonoCanon(row.tono_canon);
  const stdFromTono = tono ? findColorEstandarInCatalog(tono.etiqueta, catalog) : null;
  const sugerido = sugerirColorEstandarFromCatalog(row.nombre ?? row.predominante, catalog);
  const userCleared = draft?.etiqueta === "";
  const etiqueta =
    draft != null && !userCleared
      ? draft.etiqueta
      : userCleared
        ? SIN_TONO_ETIQUETA
        : stdFromTono?.etiqueta ?? sugerido?.etiqueta ?? SIN_TONO_ETIQUETA;
  const hex =
    draft != null && !userCleared
      ? draft.hex
      : userCleared
        ? ""
        : stdFromTono?.hex ?? sugerido?.hex ?? "";
  const sinAsignar = !etiqueta;
  const dirty =
    draft != null
      ? userCleared
        ? Boolean(tono)
        : draft.etiqueta !== (stdFromTono?.etiqueta ?? "")
      : !tono && Boolean(sugerido);
  const [paletteRect, setPaletteRect] = useState<DOMRect | null>(null);

  const applyEstandar = (c: ColorEstandar) => onDraftChange({ etiqueta: c.etiqueta, hex: c.hex });

  const onEtiquetaSelect = (value: string) => {
    if (!value) {
      onDraftChange({ etiqueta: "", hex: "" });
      return;
    }
    const std = findColorEstandarInCatalog(value, catalog);
    if (std) onDraftChange({ etiqueta: std.etiqueta, hex: std.hex });
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
          className="w-36 rounded border border-neutral-200 px-2 py-1 text-sm"
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
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="rounded bg-rimec-azul px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saving ? "…" : "Guardar"}
          </button>
          {tono && (
            <button
              type="button"
              disabled={saving}
              onClick={onClear}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 disabled:opacity-40"
              title="Quitar tono_canon"
            >
              ✕
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
