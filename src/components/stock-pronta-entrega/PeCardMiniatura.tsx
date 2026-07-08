"use client";

import { useMemo, useState } from "react";
import type { PeImportadoraCard } from "@/lib/depositos/agrupar-pe-importadora";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";
import { productImageCandidatesForRow } from "@/lib/retail/product-image";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";
import { GradaImportadoraAcordeon } from "./GradaImportadoraAcordeon";
import { ImagenAmpliadaOverlay } from "./ImagenAmpliadaOverlay";

type Props = {
  card: PeImportadoraCard;
  expanded: boolean;
  showCasoBadge?: boolean;
  /** Tránsito — chip quincena_arribo.descripcion */
  showLlegada?: boolean;
  /** Tránsito / programado — vendido + saldo en tarjeta */
  showVentas?: boolean;
};

function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p className="truncate text-[10px] leading-snug text-slate-600">
      <span className="font-semibold uppercase text-slate-500">{label}: </span>
      {value || "—"}
    </p>
  );
}

export function PeCardMiniatura({
  card,
  expanded,
  showCasoBadge = false,
  showLlegada = false,
  showVentas = false,
}: Props) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const p = card.producto;

  const imgCandidates = useMemo(
    () =>
      productImageCandidatesForRow(
        p.linea_codigo_proveedor,
        p.referencia_codigo_proveedor,
        p.material_code,
        p.color_code,
        p.imagen_nombre,
      ),
    [p],
  );

  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          className="relative flex aspect-square w-full shrink-0 items-center justify-center bg-slate-100"
          onClick={() => setZoomSrc(imgCandidates[0] ?? null)}
          aria-label="Ampliar imagen"
        >
          <DepositoProductThumb
            linea={p.linea_codigo_proveedor}
            referencia={p.referencia_codigo_proveedor}
            material={p.material_code}
            color={p.color_code}
            imagenNombre={p.imagen_nombre}
            size={140}
          />
          {showVentas && card.totalVendidos > 0 ? (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {Math.round(card.totalVendidos)} v
            </span>
          ) : null}
          {showVentas ? (
            card.totalPares > 0 ? (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-bazzar-naranja px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                {Math.round(card.totalPares)} p
              </span>
            ) : card.totalVendidos <= 0 ? (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-bold text-white">
                0 p
              </span>
            ) : null
          ) : (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-bazzar-naranja px-2 py-0.5 text-[10px] font-bold text-white">
              {Math.round(card.totalPares)} p
            </span>
          )}
        </button>

        <div
          className={`flex min-h-0 flex-1 flex-col gap-1 p-2.5 ${
            expanded ? "min-h-[11.5rem]" : "min-h-[6.75rem]"
          }`}
        >
          <div className="flex min-h-[14px] items-start justify-between gap-1">
            <p className="min-w-0 truncate text-[10px] font-bold uppercase text-rimec-azul">{p.marca}</p>
            {showLlegada ? (
              <span
                className={`max-w-[52%] shrink-0 truncate rounded border px-1.5 py-0.5 text-[7px] font-bold leading-tight ${
                  card.llegadaDesc
                    ? "border-sky-200 bg-sky-50 text-sky-900"
                    : "border-dashed border-slate-200 bg-slate-50 text-slate-400"
                }`}
                title={card.llegadaDesc ?? "Sin quincena de llegada"}
              >
                {card.llegadaDesc ?? "Sin llegada"}
              </span>
            ) : null}
          </div>
          <p className="truncate font-mono text-xs font-semibold text-slate-900">
            {p.linea_codigo_proveedor}.{p.referencia_codigo_proveedor}
          </p>

          {!expanded ? (
            <p className="line-clamp-1 min-h-[14px] text-[10px] text-slate-600">
              {[p.descp_material, p.descp_color].filter(Boolean).join(" · ") ||
                `${p.material_code} / ${p.color_code}`}
            </p>
          ) : (
            <div className="grid min-h-[5.5rem] grid-cols-2 gap-x-1 gap-y-0.5">
              <Dato label="Género" value={p.genero} />
              <Dato label="Estilo" value={p.estilo} />
              <Dato label="Tipo 1" value={p.tipo_1} />
              <Dato label="Categoría" value={p.tipo_v2} />
              <Dato label="Material" value={p.descp_material ?? p.material_code} />
              <Dato label="Color" value={p.descp_color ?? p.color_code} />
              <Dato label="Tono" value={p.tono_etiqueta} />
              <Dato label="Depósito" value={p.columna_stock_legal ?? p.deposito_codigo} />
              {showLlegada ? <Dato label="Llegada" value={card.llegadaDesc} /> : null}
            </div>
          )}

          <p className="min-h-[16px] truncate text-xs font-bold tabular-nums text-bazzar-naranja-dark">
            {card.precioVenta != null ? (
              <>
                {formatPrecioGs(card.precioVenta)}
                <span className="ml-1 text-[9px] font-semibold text-slate-500">/ par</span>
              </>
            ) : (
              <span className="text-[9px] font-semibold text-slate-400">Sin precio</span>
            )}
          </p>

          {showVentas ? (
            <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1.5 text-center">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-wide text-slate-500">Comprado</p>
                <p className="text-sm font-bold tabular-nums text-rimec-azul">
                  {Math.round(card.totalInicial).toLocaleString("es-PY")}
                </p>
              </div>
              <div>
                <p className="text-[7px] font-bold uppercase tracking-wide text-slate-500">Vendido</p>
                <p className="text-sm font-bold tabular-nums text-rose-700">
                  {Math.round(card.totalVendidos).toLocaleString("es-PY")}
                </p>
              </div>
            </div>
          ) : null}

          {showVentas ? (
            <p className="min-h-[14px] truncate text-[9px] font-semibold tabular-nums leading-tight text-slate-500">
              Saldo {Math.round(card.totalPares).toLocaleString("es-PY")} p
            </p>
          ) : null}

          {showCasoBadge && card.casoComercial ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-center text-[9px] font-bold uppercase leading-tight text-emerald-800">
              {card.casoComercial}
            </p>
          ) : null}

          {showCasoBadge && !card.casoComercial ? (
            <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-2 py-0.5 text-center text-[9px] text-gray-400">
              Sin caso BCL
            </p>
          ) : null}

          <div className="mt-auto shrink-0">
            <GradaImportadoraAcordeon
              gradas={card.gradas}
              cardExpanded={expanded}
              resetKey={!expanded}
              showVentas={showVentas}
            />
          </div>
        </div>
      </article>

      <ImagenAmpliadaOverlay
        src={zoomSrc}
        alt={`${p.linea_codigo_proveedor}.${p.referencia_codigo_proveedor}`}
        onClose={() => setZoomSrc(null)}
      />
    </>
  );
}
