"use client";

import { useMemo, useState } from "react";
import type { ReposicionArticulo, ReposicionBucket } from "@/lib/herramienta-reposicion/merge-reposicion";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";
import { ImagenAmpliadaOverlay } from "@/components/stock-pronta-entrega/ImagenAmpliadaOverlay";
import { productImageCandidatesForRow } from "@/lib/retail/product-image";

/** Fila mock: pill quincena + badge cantidad */
function PillQty({
  label,
  pares,
  badgeClass,
  pillBorderClass,
  showP = true,
}: {
  label: string;
  pares: number;
  badgeClass: string;
  pillBorderClass: string;
  showP?: boolean;
}) {
  const esPe = /^pronta\s*entrega$/i.test(label.trim());
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`max-w-[72%] truncate rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-slate-800 ${
          esPe ? "border-2 border-emerald-500" : pillBorderClass
        }`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-black tabular-nums text-white shadow-sm ${badgeClass}`}
      >
        {Math.round(pares)}
        {showP ? " p" : ""}
      </span>
    </div>
  );
}

function listOrEmpty(items: ReposicionBucket[], empty: string) {
  if (items.length === 0) {
    return <p className="text-[10px] text-slate-400">{empty}</p>;
  }
  return null;
}

type Props = { articulo: ReposicionArticulo };

/**
 * Card AM — mock Director: header · STOCK's (naranja) · VENTAS acordeón (verde)
 * 4 paneles de datos: PE disp · CP disp · CP vend · PROGRAMADO
 */
export function ReposicionArticuloCard({ articulo: a }: Props) {
  const [ventasOpen, setVentasOpen] = useState(true);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const imgCandidates = useMemo(
    () =>
      productImageCandidatesForRow(a.linea, a.referencia, a.material, a.color, a.imagen_nombre),
    [a],
  );

  /** STOCK: CP por quincena primero, PE al final (mock) */
  const stockSorted = useMemo(() => {
    const pe = a.stock.filter((b) => /^pronta\s*entrega$/i.test(b.label));
    const rest = a.stock.filter((b) => !/^pronta\s*entrega$/i.test(b.label));
    return [...rest, ...pe];
  }, [a.stock]);

  const hasVentas = a.ventasCp.length > 0 || a.ventasProgramado.length > 0;

  return (
    <>
      <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-3 pt-3">
          <p className="text-sm font-bold uppercase tracking-wide text-rimec-azul">{a.marca}</p>
        </div>
        <button
          type="button"
          className="relative mx-auto flex aspect-[4/3] w-full max-w-[240px] items-center justify-center bg-white"
          onClick={() => setZoomSrc(imgCandidates[0] ?? null)}
          aria-label="Ampliar imagen"
        >
          <DepositoProductThumb
            linea={a.linea}
            referencia={a.referencia}
            material={a.material}
            color={a.color}
            imagenNombre={a.imagen_nombre}
            size={200}
          />
        </button>
        <div className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-1">
          <p className="font-mono text-base font-bold text-slate-900">
            {a.linea}.{a.referencia}
          </p>
          <p className="text-[11px] font-medium text-slate-400">
            {a.lpn != null ? `LPN ${a.lpn.toLocaleString("es-PY")}` : "Sin LPN"}
          </p>
        </div>

        {/* STOCK's — paneles PE disp + CP disp */}
        <div className="px-3 pb-2">
          <p className="mb-1.5 text-sm font-black tracking-tight text-rimec-azul">STOCK&apos;s</p>
          <div className="space-y-2 rounded-2xl border-[3px] border-rimec-azul bg-white p-3">
            {stockSorted.length === 0 ? (
              <p className="text-[10px] text-slate-400">Sin stock disponible</p>
            ) : (
              stockSorted.map((b) => (
                <PillQty
                  key={`st-${b.label}`}
                  label={b.label}
                  pares={b.pares}
                  badgeClass="bg-bazzar-naranja"
                  pillBorderClass="border-rimec-azul/50"
                />
              ))
            )}
          </div>
        </div>

        {/* Acordeón VENTAS — CP ejecutada + PROGRAMADO (dos bloques principales) */}
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setVentasOpen((o) => !o)}
            className="mb-1.5 flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-black tracking-tight text-emerald-700">VENTAS</span>
            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              {hasVentas
                ? `${Math.round(a.totales.cpVendido + a.totales.programado)} p · ${ventasOpen ? "cerrar" : "abrir"}`
                : "— · acordeón"}
            </span>
          </button>

          {ventasOpen && (
            <div className="space-y-3 rounded-2xl border-[3px] border-emerald-600 bg-white p-3">
              <div>
                <p className="mb-2 text-sm font-bold text-emerald-700">Compra previa</p>
                {listOrEmpty(a.ventasCp, "Sin ventas ejecutadas CP")}
                <div className="space-y-2">
                  {a.ventasCp.map((b) => (
                    <PillQty
                      key={`cpv-${b.label}`}
                      label={b.label}
                      pares={b.pares}
                      badgeClass="bg-emerald-600"
                      pillBorderClass="border-rimec-azul/50"
                      showP={false}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-black uppercase tracking-wide text-emerald-700">
                  PROGRAMADO
                </p>
                {listOrEmpty(a.ventasProgramado, "Sin programado")}
                <div className="space-y-2">
                  {a.ventasProgramado.map((b) => (
                    <PillQty
                      key={`pg-${b.label}`}
                      label={b.label}
                      pares={b.pares}
                      badgeClass="bg-emerald-600"
                      pillBorderClass="border-rimec-azul/50"
                      showP={false}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
      <ImagenAmpliadaOverlay
        src={zoomSrc}
        alt={`${a.marca} ${a.linea}.${a.referencia}`}
        onClose={() => setZoomSrc(null)}
      />
    </>
  );
}
