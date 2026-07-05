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
};

function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p className="truncate text-[10px] leading-snug text-slate-600">
      <span className="font-semibold uppercase text-slate-500">{label}: </span>
      {value || "—"}
    </p>
  );
}

export function PeCardMiniatura({ card, expanded, showCasoBadge = false }: Props) {
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
          <span className="absolute right-1.5 top-1.5 rounded-full bg-bazzar-naranja px-2 py-0.5 text-[10px] font-bold text-white">
            {Math.round(card.totalPares)} p
          </span>
        </button>

        <div
          className={`flex min-h-0 flex-1 flex-col gap-1 p-2.5 ${
            expanded ? "min-h-[11.5rem]" : "min-h-[6.75rem]"
          }`}
        >
          <p className="truncate text-[10px] font-bold uppercase text-rimec-azul">{p.marca}</p>
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
