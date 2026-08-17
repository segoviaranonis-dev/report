"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReposicionArticulo, ReposicionBucket } from "@/lib/herramienta-reposicion/merge-reposicion";
import { nivelAmLabel, nivelAmTitulo, type NivelAm } from "@/lib/herramienta-reposicion/nivel-am";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";
import { ImagenAmpliadaOverlay } from "@/components/stock-pronta-entrega/ImagenAmpliadaOverlay";
import { productImageCandidatesForRow, productImagePrimaryFileName } from "@/lib/retail/product-image";
import { normalizeCasoNombre } from "@/lib/depositos/caso-biblioteca";
import { esLiquidacionRow } from "@/lib/filtros/filtro-tipo-canonico";
import { DatoDuroCpFilas } from "@/components/herramienta-reposicion/DatoDuroCpFilas";
import { PP_ABIERTO_LABEL } from "@/lib/herramienta-reposicion/queries-pp-abierto";
import { cromaticaCp } from "@/lib/pedido-proveedor/cromaticaCpConfecciones";

function esCasoPromo(caso: string | null | undefined): boolean {
  return normalizeCasoNombre(caso) === "PROMOCIONAL";
}

/** Fila mock: pill quincena + badge cantidad */
function PillQty({
  label,
  pares,
  badgeClass,
  pillBorderClass,
  showP = true,
  peLiquidacion = false,
  ppAbierto = false,
  preventa,
  quincena,
  esConfecciones = false,
}: {
  label: string;
  pares: number;
  badgeClass: string;
  pillBorderClass: string;
  showP?: boolean;
  peLiquidacion?: boolean;
  ppAbierto?: boolean;
  preventa?: string | null;
  quincena?: string | null;
  esConfecciones?: boolean;
}) {
  const esPe = /^pronta\s*entrega$/i.test(label.trim());
  const esPpAbierto = ppAbierto || label === PP_ABIERTO_LABEL;
  const esCpDatoDuro = Boolean(preventa || quincena);
  const croma = cromaticaCp(esConfecciones ? "confecciones" : "calzado");
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`max-w-[72%] rounded-full border px-3 py-1 ${
          peLiquidacion && esPe
            ? "catalog-card-liquidacion-pulse border-2 border-emerald-600 bg-emerald-50 font-bold text-emerald-900"
            : esPpAbierto
              ? "border-2 border-dashed border-indigo-500 bg-indigo-50 font-bold text-indigo-900"
              : esPe
                ? "border-2 border-emerald-500 bg-white"
                : esCpDatoDuro && esConfecciones
                  ? `border py-1.5 ${croma.pill}`
                  : esCpDatoDuro
                    ? "border-rimec-azul/50 bg-white py-1.5"
                    : `bg-white ${pillBorderClass}`
        } ${esCpDatoDuro ? "" : "truncate text-[11px] font-semibold text-slate-800"}`}
      >
        {peLiquidacion && esPe ? (
          "Pronta entrega · LIQ"
        ) : esCpDatoDuro ? (
          <DatoDuroCpFilas
            preventa={preventa}
            quincena={quincena}
            labelCombinada={label}
            ramo={esConfecciones ? "confecciones" : "calzado"}
          />
        ) : (
          label
        )}
      </span>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-black tabular-nums text-white shadow-sm ${
          peLiquidacion && esPe
            ? "catalog-card-liquidacion-pulse bg-emerald-600"
            : esPpAbierto
              ? "bg-indigo-600"
              : badgeClass
        }`}
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

type Props = {
  articulo: ReposicionArticulo;
  /** Sync con «Extender todos los datos» */
  expanded?: boolean;
  /** Nivel AM fijado al cargar — no depende de filtros UI */
  nivelAm?: NivelAm;
  /**
   * Ranking 1-based Ordenamiento por compra previa / Programado.
   * Si > 0, el chip muestra #N (categoría N1/N2/N3 queda en filtros).
   */
  rankOrden?: number;
};

/**
 * Card AM — mock Director: header · STOCK's (naranja) · VENTAS acordeón (verde)
 * 4 paneles de datos: PE disp · CP disp · CP vend · PROGRAMADO
 */
export function ReposicionArticuloCard({
  articulo: a,
  expanded = false,
  nivelAm: nivel = 0,
  rankOrden = 0,
}: Props) {
  const [ventasOpen, setVentasOpen] = useState(true);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  useEffect(() => {
    setVentasOpen(expanded);
  }, [expanded]);

  const imageCtx = useMemo(
    () => ({
      tipoV2Id: a.tipo_v2_id,
      imagenColorExcel: a.imagen_color_excel,
    }),
    [a.tipo_v2_id, a.imagen_color_excel],
  );

  const imgCandidates = useMemo(
    () =>
      productImageCandidatesForRow(
        a.linea,
        a.referencia,
        a.material,
        a.color,
        a.imagen_nombre,
        "thumb",
        imageCtx,
      ),
    [a, imageCtx],
  );

  const nombreFoto = useMemo(
    () =>
      productImagePrimaryFileName(
        a.linea,
        a.referencia,
        a.material,
        a.color,
        { ...imageCtx, imagenNombre: a.imagen_nombre },
      ),
    [a.linea, a.referencia, a.material, a.color, a.imagen_nombre, imageCtx],
  );

  const nombreFotoDisplay = nombreFoto?.replace(/\.jpe?g$/i, "") ?? null;

  /** STOCK: solo PE + CP real + PP · Magno: nunca labels/preventas de PROGRAMADO */
  const stockSorted = useMemo(() => {
    const progLabels = new Set(
      [...(a.programadoSaldo ?? []), ...a.ventasProgramado].map((b) => b.label),
    );
    const progPrev = new Set(
      [...(a.programadoSaldo ?? []), ...a.ventasProgramado]
        .map((b) => String(b.preventa ?? "").trim())
        .filter(Boolean),
    );
    const limpio = a.stock.filter((b) => {
      if (/^pronta\s*entrega$/i.test(b.label) || b.label === PP_ABIERTO_LABEL) return true;
      const prev = String(b.preventa ?? "").trim();
      if (progLabels.has(b.label)) return false;
      if (prev && progPrev.has(prev)) return false;
      return true;
    });
    const pe = limpio.filter((b) => /^pronta\s*entrega$/i.test(b.label));
    const pp = limpio.filter((b) => b.label === PP_ABIERTO_LABEL);
    const rest = limpio.filter(
      (b) => !/^pronta\s*entrega$/i.test(b.label) && b.label !== PP_ABIERTO_LABEL,
    );
    return [...rest, ...pp, ...pe];
  }, [a.stock, a.programadoSaldo, a.ventasProgramado]);

  const programadoSaldo = a.programadoSaldo ?? [];
  const hasVentas =
    a.ventasCp.length > 0 || a.ventasProgramado.length > 0 || programadoSaldo.length > 0;
  const progVendido = a.ventasProgramado.reduce((s, b) => s + Math.round(b.pares), 0);
  const progSaldo = programadoSaldo.reduce((s, b) => s + Math.round(b.pares), 0);
  const esLiq = esLiquidacionRow(a);
  const esPromo = !esLiq && esCasoPromo(a.caso_precio);
  const tienePe = a.totales.peDisponible > 0;
  const esConfecciones = Number(a.tipo_v2_id) === 2;

  /** overflow-hidden recorta el glow del latido — solo en el bloque de imagen */
  const cardPulseClass = esLiq
    ? "catalog-card-liquidacion-pulse border-2 border-emerald-500"
    : esPromo
      ? "catalog-card-promo-pulse border-2 border-amber-400"
      : "border border-slate-200";

  const nivelChipClass =
    nivel === 1
      ? "border-violet-300 bg-violet-50 text-violet-900"
      : nivel === 2
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : nivel === 3
          ? "border-slate-300 bg-slate-100 text-slate-700"
          : "border-slate-200 bg-white text-slate-400";

  const showRank = rankOrden > 0;
  const chipClass = showRank
    ? "border-violet-400 bg-violet-600 text-white"
    : nivelChipClass;
  const chipLabel = showRank ? `#${rankOrden}` : nivel > 0 ? nivelAmLabel(nivel as NivelAm) : null;
  const chipTitle = showRank
    ? `Orden #${rankOrden}${nivel > 0 ? ` · ${nivelAmTitulo(nivel as NivelAm)}` : ""}`
    : nivel > 0
      ? nivelAmTitulo(nivel as NivelAm)
      : undefined;

  return (
    <>
      <article
        className={`relative z-0 flex flex-col rounded-2xl bg-white shadow-sm ${cardPulseClass}`}
      >
        <div className="shrink-0 px-3 pt-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-rimec-azul">
              {a.marca}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {esLiq ? (
                <span
                  className="catalog-card-liquidacion-pulse rounded-full border border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white"
                  title="PE liquidación (SDRM)"
                >
                  LIQ
                </span>
              ) : null}
              {esPromo ? (
                <span
                  className="catalog-card-promo-pulse rounded-full border border-amber-500 bg-amber-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white"
                  title="Caso PROMOCIONAL"
                >
                  PROMO
                </span>
              ) : null}
              {chipLabel ? (
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black tabular-nums ${chipClass}`}
                  title={chipTitle}
                >
                  {chipLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {/* Marco sagrado — overflow hidden + contain (LEY 2.01.04.021). Prohibido object-cover. */}
        <button
          type="button"
          className="relative mx-3 mt-2 aspect-square w-[calc(100%-1.5rem)] max-w-none shrink-0 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200"
          onClick={() => setZoomSrc(imgCandidates[0] ?? null)}
          aria-label="Ampliar imagen"
        >
          <DepositoProductThumb
            linea={a.linea}
            referencia={a.referencia}
            material={a.material}
            color={a.color}
            imagenNombre={a.imagen_nombre}
            imageCtx={imageCtx}
            variant="frame"
          />
        </button>
        <div className="flex shrink-0 items-baseline justify-between gap-2 px-3 pb-2 pt-2">
          <div className="min-w-0">
            <p
              className="truncate font-mono text-sm font-bold text-slate-900"
              title={nombreFotoDisplay ?? undefined}
            >
              {nombreFotoDisplay ??
                (Number(a.tipo_v2_id) === 2
                  ? `${a.linea}_${a.color}`
                  : [a.linea, a.referencia, a.material, a.color].filter(Boolean).join("-"))}
            </p>
          </div>
          <p className="shrink-0 text-[11px] font-medium text-slate-400">
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
                  preventa={b.preventa}
                  quincena={b.quincena}
                  pares={b.pares}
                  badgeClass="bg-bazzar-naranja"
                  pillBorderClass="border-rimec-azul/50"
                  peLiquidacion={esLiq && tienePe}
                  ppAbierto={b.label === PP_ABIERTO_LABEL}
                  esConfecciones={esConfecciones}
                />
              ))
            )}
            {stockSorted.length > 0 ? (
              <p className="mt-2 border-t border-rimec-azul/15 pt-2 text-[10px] font-bold tabular-nums text-rimec-azul-dark">
                Σ stock{" "}
                {Math.round(
                  stockSorted.reduce((s, b) => s + b.pares, 0),
                )}{" "}
                p · PE {Math.round(a.totales.peDisponible)} · CP{" "}
                {Math.round(
                  stockSorted
                    .filter(
                      (b) =>
                        !/^pronta\s*entrega$/i.test(b.label) && b.label !== PP_ABIERTO_LABEL,
                    )
                    .reduce((s, b) => s + b.pares, 0),
                )}{" "}
                · PP {Math.round(a.totales.ppAbierto)}
              </p>
            ) : null}
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
                      preventa={b.preventa}
                      quincena={b.quincena}
                      pares={b.pares}
                      badgeClass="bg-emerald-600"
                      pillBorderClass="border-rimec-azul/50"
                      showP={false}
                      esConfecciones={esConfecciones}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-black uppercase tracking-wide text-emerald-700">
                  PROGRAMADO
                </p>
                {listOrEmpty(
                  [...programadoSaldo, ...a.ventasProgramado],
                  "Sin programado",
                )}
                {programadoSaldo.length > 0 ? (
                  <div className="mb-2 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      Saldo pendiente
                    </p>
                    {programadoSaldo.map((b) => (
                      <PillQty
                        key={`pgs-${b.label}`}
                        label={b.label}
                        preventa={b.preventa}
                        quincena={b.quincena}
                        pares={b.pares}
                        badgeClass="bg-amber-600"
                        pillBorderClass="border-amber-500/60"
                        showP={false}
                        esConfecciones={esConfecciones}
                      />
                    ))}
                  </div>
                ) : null}
                {a.ventasProgramado.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      Vendido
                    </p>
                    {a.ventasProgramado.map((b) => (
                      <PillQty
                        key={`pgv-${b.label}`}
                        label={b.label}
                        preventa={b.preventa}
                        quincena={b.quincena}
                        pares={b.pares}
                        badgeClass="bg-emerald-600"
                        pillBorderClass="border-rimec-azul/50"
                        showP={false}
                        esConfecciones={esConfecciones}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {hasVentas ? (
                <p className="border-t border-emerald-200 pt-2 text-[10px] font-bold tabular-nums text-emerald-800">
                  Σ ventas {Math.round(a.totales.cpVendido + a.totales.programado)} p · CP vend.{" "}
                  {Math.round(a.totales.cpVendido)} · Prog. saldo {progSaldo} · vend. {progVendido}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </article>
      <ImagenAmpliadaOverlay
        src={zoomSrc}
        alt={`${
          nombreFotoDisplay ??
          (Number(a.tipo_v2_id) === 2
            ? `${a.linea}_${a.color}`
            : [a.linea, a.referencia, a.material, a.color].filter(Boolean).join("-"))
        } ${a.marca}`}
        onClose={() => setZoomSrc(null)}
      />
    </>
  );
}
