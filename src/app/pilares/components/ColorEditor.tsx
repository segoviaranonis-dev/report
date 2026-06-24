"use client";

import { useState } from "react";
import type { TipoV2Id } from "@/lib/pilares/types";
import { findColorEstandarInCatalog, type ColorEstandar } from "@/lib/pilares/colores-estandar";
import { ColorSwatchButton, PaletaColoresEstandar } from "./PaletaColoresEstandar";

interface ColorEditorProps {
  tipoV2Id: TipoV2Id;
  catalog: ColorEstandar[];
  onApplied: () => Promise<void>;
}

export function ColorEditor({ tipoV2Id, catalog, onApplied }: ColorEditorProps) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [hex, setHex] = useState("");
  const [usarSugerencia, setUsarSugerencia] = useState(true);
  const [soloSinTono, setSoloSinTono] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paletteRect, setPaletteRect] = useState<DOMRect | null>(null);

  const pickEstandar = (c: ColorEstandar) => {
    setEtiqueta(c.etiqueta);
    setHex(c.hex);
    setUsarSugerencia(false);
  };

  const onEtiquetaSelect = (value: string) => {
    const std = findColorEstandarInCatalog(value, catalog);
    if (std) {
      setEtiqueta(std.etiqueta);
      setHex(std.hex);
    } else {
      setEtiqueta(value);
    }
    setUsarSugerencia(false);
  };

  const apply = async () => {
    setError(null);
    setSuccess(null);
    const d = desde.trim();
    const h = hasta.trim();
    if (!d || !h) {
      setError("Indicá código color inicial y final.");
      return;
    }
    if (d > h) {
      setError("Código inicial debe ser ≤ final.");
      return;
    }
    if (!usarSugerencia && !etiqueta.trim()) {
      setError("Elegí un color estándar o activá «sugerir desde nombre».");
      return;
    }

    setApplying(true);
    try {
      const body: Record<string, unknown> = {
        rango: true,
        tipo_v2_id: tipoV2Id,
        desde: d,
        hasta: h,
        hex,
        usar_predominante: usarSugerencia,
        solo_sin_tono: soloSinTono,
      };
      if (!usarSugerencia) {
        body.etiqueta = etiqueta.trim();
      }

      const res = await fetch("/api/pilares/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo aplicar");
      setSuccess(`${data.updated ?? 0} colores actualizados en rango ${d}–${h}`);
      await onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  };

  return (
    <details open className="mb-4 rounded-xl border-2 border-rimec-azul/25 bg-card-bg shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <span className="font-serif text-lg font-semibold text-rimec-azul-dark">Editor por rango</span>
        <span className="ml-2 text-sm font-normal text-neutral-500">
          Códigos color · catálogo BD (dominante primero)
        </span>
      </summary>

      <div className="space-y-4 border-t border-rimec-azul/10 px-5 pb-5 pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Código inicial</span>
            <input
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              placeholder="109700"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Código final</span>
            <input
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              placeholder="109800"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Color estándar</span>
            <select
              value={etiqueta}
              onChange={(e) => onEtiquetaSelect(e.target.value)}
              disabled={usarSugerencia}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-100"
            >
              <option value="">— elegir color —</option>
              {catalog.map((c) => (
                <option key={c.etiqueta} value={c.etiqueta}>
                  {c.etiqueta}
                  {c.uso_count != null ? ` (${c.uso_count})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Tono</span>
            <div className="flex items-center gap-2">
              <ColorSwatchButton hex={hex} etiqueta={etiqueta} empty={!etiqueta} onOpenPalette={setPaletteRect} />
              <span className="font-mono text-xs text-neutral-500">{hex || "—"}</span>
            </div>
          </label>
        </div>

        <PaletaColoresEstandar
          open={Boolean(paletteRect)}
          catalog={catalog}
          anchorRect={paletteRect}
          selectedEtiqueta={etiqueta}
          onSelect={pickEstandar}
          onClose={() => setPaletteRect(null)}
        />

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={usarSugerencia} onChange={(e) => setUsarSugerencia(e.target.checked)} />
            Sugerir estándar desde nombre proveedor
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={soloSinTono} onChange={(e) => setSoloSinTono(e.target.checked)} />
            Solo filas sin tono_canon
          </label>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}

        <button
          type="button"
          disabled={applying}
          onClick={apply}
          className="rounded-lg bg-rimec-azul px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {applying ? "Aplicando…" : "Aplicar rango"}
        </button>
      </div>
    </details>
  );
}
