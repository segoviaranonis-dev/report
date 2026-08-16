"use client";

import { useRef, useState } from "react";
import { PaletaColoresEstandar } from "@/app/pilares/components/PaletaColoresEstandar";
import {
  findColorEstandarInCatalog,
  OTROS_MULTICOLOR_SWATCHES,
  estandarToTono,
  type ColorEstandar,
} from "@/lib/pilares/colores-estandar";
import { tonoCircleStyle, tonoPaleta } from "@/lib/pilares/color-canon";

type Props = {
  colorId: number;
  tipoV2Id: number | null | undefined;
  tonoEtiqueta: string | null | undefined;
  catalog: ColorEstandar[];
  onPatched: (colorId: number, etiqueta: string | null) => void;
};

/**
 * Círculo TONO en tarjeta PE — escribe `color.tono_canon` (misma API Admin).
 */
export function PeEditorTonoCircle({
  colorId,
  tipoV2Id,
  tonoEtiqueta,
  catalog,
  onPatched,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const etiqueta = tonoEtiqueta?.trim() || null;
  const std = etiqueta ? findColorEstandarInCatalog(etiqueta, catalog) : null;
  const sinAsignar = !etiqueta;
  const swatchStyle = std
    ? std.multicolor
      ? tonoCircleStyle(tonoPaleta(std.etiqueta, std.swatches?.length ? std.swatches : OTROS_MULTICOLOR_SWATCHES))
      : tonoCircleStyle(estandarToTono(std))
    : undefined;

  const openPaleta = () => {
    if (!colorId || busy) return;
    setErr(null);
    setAnchor(btnRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  const patch = async (stdSel: ColorEstandar | null) => {
    if (!colorId) return;
    const tv2 = tipoV2Id === 2 ? 2 : 1;
    setBusy(true);
    setErr(null);
    try {
      const body =
        stdSel == null
          ? { id: colorId, tipo_v2_id: tv2, clear_tono: true }
          : { id: colorId, tipo_v2_id: tv2, tono_canon: estandarToTono(stdSel) };
      const res = await fetch("/api/pilares/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setErr(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      onPatched(colorId, stdSel?.etiqueta ?? null);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={!colorId || busy}
        onClick={(e) => {
          e.stopPropagation();
          openPaleta();
        }}
        title={
          sinAsignar
            ? "Asignar TONO (Administrador Color)"
            : `TONO ${etiqueta} — clic para cambiar`
        }
        aria-label={sinAsignar ? "Asignar TONO" : `TONO ${etiqueta}`}
        className={`relative h-4 w-4 shrink-0 rounded-full border-2 transition hover:scale-110 disabled:opacity-40 ${
          sinAsignar
            ? "border-dashed border-slate-400 bg-white"
            : "border-slate-700 shadow-sm"
        } ${busy ? "animate-pulse" : ""}`}
        style={sinAsignar ? undefined : swatchStyle}
      />
      {err ? (
        <span className="max-w-[4.5rem] truncate text-[8px] font-medium text-red-600" title={err}>
          !
        </span>
      ) : null}
      <PaletaColoresEstandar
        open={open}
        catalog={catalog}
        selectedEtiqueta={etiqueta ?? undefined}
        anchorRect={anchor}
        onSelect={(c) => void patch(c)}
        onClose={() => setOpen(false)}
        onClear={() => void patch(null)}
      />
    </>
  );
}
