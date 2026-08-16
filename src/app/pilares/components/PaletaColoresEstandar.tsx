"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  /** Quitar tono_canon (Sin asignar) */
  onClear?: () => void;
}

export function PaletaColoresEstandar({
  open,
  catalog,
  selectedEtiqueta,
  anchorRect,
  onSelect,
  onClose,
  onClear,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    /** Diferir: si se registra en el mismo tick del clic que abre, cierra al instante. */
    const t = window.setTimeout(() => {
      window.addEventListener("keydown", onKey);
      window.addEventListener("mousedown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onClose]);

  if (!open || !anchorRect || typeof document === "undefined") return null;

  const panelH = 140;
  const spaceBelow = typeof window !== "undefined" ? window.innerHeight - anchorRect.bottom : 400;
  const top =
    spaceBelow < panelH + 12
      ? Math.max(8, anchorRect.top - panelH - 6)
      : anchorRect.bottom + 6;
  const left = Math.min(
    Math.max(8, anchorRect.left - 80),
    typeof window !== "undefined" ? window.innerWidth - 300 : anchorRect.left,
  );

  const items = catalog.length ? catalog : COLORES_ESTANDAR_DEFAULT;
  const selected = selectedEtiqueta
    ? findColorEstandarInCatalog(selectedEtiqueta, items)?.etiqueta
    : undefined;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Colores estándar"
      className="fixed z-[200] rounded-lg border border-neutral-600 bg-neutral-800 p-3 shadow-xl"
      style={{ top, left, minWidth: 280 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-200">
        Colores estándar · dominante primero
      </p>
      <div className="flex flex-wrap gap-1.5">
        {onClear ? (
          <button
            type="button"
            title="Sin asignar — quitar tono"
            onClick={() => {
              onClear();
            }}
            className="h-7 rounded-sm border border-dashed border-neutral-500 px-2 text-[10px] font-semibold uppercase text-neutral-300 hover:border-amber-400 hover:text-amber-200"
          >
            Sin asignar
          </button>
        ) : null}
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
    </div>,
    document.body,
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
      className={`${dim} shrink-0 rounded-sm transition hover:ring-2 hover:ring-rimec-azul/60 ${
        empty
          ? "border-2 border-dashed border-neutral-300 bg-neutral-100"
          : "ring-1 ring-neutral-300"
      }`}
      style={empty ? undefined : swatchStyle ?? (hex ? { backgroundColor: hex } : undefined)}
    />
  );
}
