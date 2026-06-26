"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { tonoCircleStyle, tonoPaleta } from "@/lib/pilares/color-canon";
import {
  COLORES_ESTANDAR_DEFAULT,
  findColorEstandarInCatalog,
  OTROS_MULTICOLOR_SWATCHES,
  type ColorEstandar,
} from "@/lib/pilares/colores-estandar";

interface Props {
  open: boolean;
  catalog: ColorEstandar[];
  selectedEtiqueta?: string;
  anchorRect: DOMRect | null;
  onSelect: (color: ColorEstandar) => void;
  onClose: () => void;
}

export function PaletaColoresEstandar({ open, catalog, selectedEtiqueta, anchorRect, onSelect, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const top = anchorRect.bottom + 6;
  const left = Math.max(8, anchorRect.left - 80);

  const items = catalog.length ? catalog : COLORES_ESTANDAR_DEFAULT;
  const selected = selectedEtiqueta ? findColorEstandarInCatalog(selectedEtiqueta, items)?.etiqueta : undefined;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Colores estándar"
      className="fixed z-50 rounded-lg border border-neutral-600 bg-neutral-800 p-3 shadow-xl"
      style={{ top, left, minWidth: 280 }}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-200">
        Colores estándar · dominante primero
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => {
          const active = selected === c.etiqueta;
          const swatchStyle = c.multicolor
            ? tonoCircleStyle(
                tonoPaleta(c.etiqueta, c.swatches?.length ? c.swatches : OTROS_MULTICOLOR_SWATCHES),
              )
            : { backgroundColor: c.hex };
          return (
            <button
              key={c.etiqueta}
              type="button"
              title={`${c.etiqueta}${c.multicolor ? " · multicolor" : ""}${
                c.uso_count != null ? ` · ${c.uso_count} usos` : ""
              }`}
              onClick={() => {
                onSelect(c);
                onClose();
              }}
              className={`h-7 w-7 rounded-sm ring-offset-2 ring-offset-neutral-800 transition hover:scale-110 ${
                active ? "ring-2 ring-amber-400" : "ring-1 ring-neutral-600"
              }`}
              style={swatchStyle}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-neutral-400">
        Etiqueta filtro = estándar (ej. Avela · Cacao → Beige / Marrón)
      </p>
    </div>
  );
}

interface SwatchButtonProps {
  hex?: string;
  etiqueta?: string;
  empty?: boolean;
  size?: "sm" | "md";
  swatchStyle?: CSSProperties;
  onOpenPalette: (rect: DOMRect) => void;
}

export function ColorSwatchButton({
  hex,
  etiqueta,
  empty = false,
  size = "md",
  swatchStyle,
  onOpenPalette,
}: SwatchButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <button
      ref={btnRef}
      type="button"
      title={empty ? "Sin tono — clic para asignar" : `Tono: ${etiqueta} — clic para paleta`}
      onClick={() => {
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) onOpenPalette(rect);
      }}
      className={`${dim} shrink-0 rounded-full transition hover:ring-2 hover:ring-rimec-azul/60 ${
        empty
          ? "border-2 border-dashed border-neutral-300 bg-neutral-100"
          : "ring-1 ring-neutral-300"
      }`}
      style={empty ? undefined : swatchStyle ?? (hex ? { backgroundColor: hex } : undefined)}
    />
  );
}
