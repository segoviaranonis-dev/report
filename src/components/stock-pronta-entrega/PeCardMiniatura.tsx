"use client";

import { useMemo, useState } from "react";
import type { PeImportadoraCard } from "@/lib/depositos/agrupar-pe-importadora";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";
import { productImageCandidatesForRow, productImagePrimaryFileName } from "@/lib/retail/product-image";
import { isConfecciones638, etiquetaUnidadStock } from "@/lib/deposito-rimec/grada-abierta-638";
import { cadenaPeDeRow, etiquetaCadenaPeUi } from "@/lib/stock-pronta-entrega/diccionario-pe";
import {
  peGrupoUnoShellClass,
  resolvePeGrupoUnoShell,
} from "@/lib/stock-pronta-entrega/pe-grupo-uno-visual";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";
import { CompradoresVentasSlot } from "./CompradoresVentasSlot";
import { GradaImportadoraAcordeon } from "./GradaImportadoraAcordeon";
import { ImagenAmpliadaOverlay } from "./ImagenAmpliadaOverlay";
import { PeLiqBadge } from "./PeLiqBadge";
import { PeProBadge } from "./PeProBadge";
import { PeEditorTonoCircle } from "./PeEditorTonoCircle";
import { PeEditorEstiloTipo1 } from "./PeEditorEstiloTipo1";
import { descpColorUiPe, descpMaterialUiPe } from "@/lib/stock-pronta-entrega/pe-filtro-pilar-638";
import type { ColorEstandar } from "@/lib/pilares/colores-estandar";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";

type Props = {
  card: PeImportadoraCard;
  expanded: boolean;
  showCasoBadge?: boolean;
  showDiccionarioBadge?: boolean;
  /** % descuento dictado · se pinta junto al precio (slate). */
  descuentoPct?: number | null;
  /** Tránsito — chip quincena_arribo.descripcion */
  showLlegada?: boolean;
  /** Tránsito / programado — vendido + saldo en tarjeta */
  showVentas?: boolean;
  /** Edición TONO · una verdad pilares */
  enableTonoEdit?: boolean;
  tonoCatalog?: ColorEstandar[];
  onTonoPatched?: (colorId: number, etiqueta: string | null) => void;
  enableLrEdit?: boolean;
  estiloOptions?: DepositoFilterItem[];
  tipo1Options?: DepositoFilterItem[];
  onLrPatched?: (
    lrId: number,
    patch: {
      grupo_estilo_id?: number | null;
      estilo?: string | null;
      tipo_1_id?: number | null;
      tipo_1?: string | null;
    },
  ) => void;
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
  showDiccionarioBadge = false,
  descuentoPct = null,
  showLlegada = false,
  showVentas = false,
  enableTonoEdit = false,
  tonoCatalog,
  onTonoPatched,
  enableLrEdit = false,
  estiloOptions,
  tipo1Options,
  onLrPatched,
}: Props) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const p = card.producto;
  const esConf = isConfecciones638(p.tipo_v2_id);
  const matUi = descpMaterialUiPe(p);
  const colUi = descpColorUiPe(p);
  const uStock = etiquetaUnidadStock(p.tipo_v2_id);
  const shell = resolvePeGrupoUnoShell(p);
  const shellClass = peGrupoUnoShellClass(shell);

  const imageCtx = useMemo(
    () => ({
      tipoV2Id: p.tipo_v2_id,
      imagenColorExcel: p.imagen_color_excel ?? null,
    }),
    [p.tipo_v2_id, p.imagen_color_excel],
  );

  const imgCandidates = useMemo(
    () =>
      productImageCandidatesForRow(
        p.linea_codigo_proveedor,
        p.referencia_codigo_proveedor,
        p.material_code,
        p.color_code,
        p.imagen_nombre,
        "thumb",
        imageCtx,
      ),
    [p, imageCtx],
  );

  const nombreFotoDisplay = useMemo(() => {
    const fn = productImagePrimaryFileName(
      p.linea_codigo_proveedor,
      p.referencia_codigo_proveedor,
      p.material_code,
      p.color_code,
      { ...imageCtx, imagenNombre: p.imagen_nombre },
    );
    return fn?.replace(/\.jpe?g$/i, "") ?? null;
  }, [p, imageCtx]);

  const stockPos = shell === "liquidacion" ? "bottom-1.5" : "top-1.5";

  const precios638 = useMemo(() => {
    if (!esConf) return [] as number[];
    return [
      ...new Set(
        card.gradas
          .map((g) => (g.lpn != null && Number(g.lpn) > 0 ? Number(g.lpn) : null))
          .filter((n): n is number => n != null),
      ),
    ].sort((a, b) => a - b);
  }, [esConf, card.gradas]);

  const stockBadge = showVentas ? (
    card.totalPares > 0 ? (
      <span
        className={`absolute right-1.5 ${stockPos} rounded-full bg-bazzar-naranja px-2 py-0.5 text-[10px] font-bold text-white shadow-sm`}
      >
        {Math.round(card.totalPares)} {uStock}
      </span>
    ) : card.totalVendidos <= 0 ? (
      <span
        className={`absolute right-1.5 ${stockPos} rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-bold text-white`}
      >
        0 p
      </span>
    ) : null
  ) : (
    <span
      className={`absolute right-1.5 ${stockPos} rounded-full bg-bazzar-naranja px-2 py-0.5 text-[10px] font-bold text-white shadow-sm`}
    >
      {Math.round(card.totalPares)} p
    </span>
  );

  return (
    <>
      <article className={`flex h-full min-h-0 flex-col rounded-xl border shadow-sm ${shellClass}`}>
        <button
          type="button"
          className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-xl bg-slate-100"
          onClick={() => setZoomSrc(imgCandidates[0] ?? null)}
          aria-label="Ampliar imagen"
        >
          <DepositoProductThumb
            linea={p.linea_codigo_proveedor}
            referencia={p.referencia_codigo_proveedor}
            material={p.material_code}
            color={p.color_code}
            imagenNombre={p.imagen_nombre}
            imageCtx={imageCtx}
            variant="frame"
          />
          {showVentas && card.totalVendidos > 0 ? (
            <span
              className={`absolute left-1.5 top-1.5 rounded-full ${VENTA_VISUAL.badge} px-2 py-0.5 text-[10px] font-bold ${VENTA_VISUAL.badgeFg} shadow-sm`}
            >
              {Math.round(card.totalVendidos)} v
            </span>
          ) : null}
          {shell === "liquidacion" ? <PeLiqBadge /> : null}
          {stockBadge}
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
          {nombreFotoDisplay ? (
            <p
              className="truncate px-0.5 font-mono text-[10px] font-semibold text-slate-800"
              title={esConf ? "Stem 638 L+C" : "Stem 654 L+R+M+C"}
            >
              {nombreFotoDisplay}
            </p>
          ) : null}
          <div className="flex min-h-[14px] items-start justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1">
              <p className="min-w-0 truncate text-[10px] font-bold uppercase text-rimec-azul">{p.marca}</p>
              {enableTonoEdit && tonoCatalog && onTonoPatched && p.color_id > 0 ? (
                <PeEditorTonoCircle
                  colorId={p.color_id}
                  tipoV2Id={p.tipo_v2_id}
                  tonoEtiqueta={p.tono_etiqueta}
                  catalog={tonoCatalog}
                  onPatched={onTonoPatched}
                />
              ) : null}
              {shell === "promo" ? <PeProBadge /> : null}
            </div>
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
            {!esConf ? `${p.linea_codigo_proveedor}.${p.referencia_codigo_proveedor}` : null}
          </p>

          {!expanded ? (
            <p className="line-clamp-1 min-h-[14px] text-[10px] text-slate-600">
              {[matUi, colUi].filter(Boolean).join(" · ") ||
                (esConf ? "—" : `${p.material_code} / ${p.color_code}`)}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-1 gap-y-px">
              <Dato label="Género" value={p.genero} />
              {enableLrEdit && onLrPatched ? (
                <PeEditorEstiloTipo1
                  field="estilo"
                  lineaReferenciaId={p.linea_referencia_id}
                  tipoV2Id={p.tipo_v2_id}
                  currentId={p.grupo_estilo_id}
                  currentLabel={p.estilo}
                  options={estiloOptions ?? []}
                  onPatched={(lrId, patch) =>
                    onLrPatched(lrId, {
                      grupo_estilo_id: patch.id,
                      estilo: patch.label,
                    })
                  }
                />
              ) : (
                <Dato label="Estilo" value={p.estilo} />
              )}
              {enableLrEdit && onLrPatched ? (
                <PeEditorEstiloTipo1
                  field="tipo1"
                  lineaReferenciaId={p.linea_referencia_id}
                  tipoV2Id={p.tipo_v2_id}
                  currentId={p.tipo_1_id}
                  currentLabel={p.tipo_1}
                  options={tipo1Options ?? []}
                  onPatched={(lrId, patch) =>
                    onLrPatched(lrId, {
                      tipo_1_id: patch.id,
                      tipo_1: patch.label,
                    })
                  }
                />
              ) : (
                <Dato label="Tipo 1" value={p.tipo_1} />
              )}
              <Dato label="Categoría" value={p.tipo_v2} />
              <Dato label="Material" value={matUi ?? (esConf ? null : p.material_code)} />
              <Dato label="Color" value={colUi ?? (esConf ? null : p.color_code)} />
              <Dato label="Tono" value={p.tono_etiqueta} />
              <Dato label="Depósito" value={p.columna_stock_legal ?? p.deposito_codigo} />
              {showLlegada ? <Dato label="Llegada" value={card.llegadaDesc} /> : null}
            </div>
          )}

          <p className="flex min-h-[16px] flex-wrap items-baseline gap-x-1.5 truncate text-xs font-bold tabular-nums text-bazzar-naranja-dark">
            {precios638.length > 1 ? (
              <>
                {formatPrecioGs(precios638[0])}
                <span className="text-[9px] font-semibold text-slate-400">–</span>
                {formatPrecioGs(precios638[precios638.length - 1])}
                <span className="text-[9px] font-semibold text-violet-700">
                  / prenda · {precios638.length} precios
                </span>
              </>
            ) : card.precioVenta != null ? (
              <>
                {formatPrecioGs(card.precioVenta)}
                <span className="text-[9px] font-semibold text-slate-500">
                  / {esConf ? "prenda" : "par"}
                </span>
              </>
            ) : (
              <span className="text-[9px] font-semibold text-slate-400">Sin precio</span>
            )}
            {descuentoPct != null && descuentoPct > 0 ? (
              <span
                className="text-[9px] font-medium tabular-nums text-slate-500"
                title="Descuento comercial dictado"
              >
                −{descuentoPct}%
              </span>
            ) : null}
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
                <p className={`text-sm font-bold tabular-nums ${VENTA_VISUAL.label}`}>
                  {Math.round(card.totalVendidos).toLocaleString("es-PY")}
                </p>
              </div>
            </div>
          ) : null}

          {showVentas ? (
            <p className="min-h-[14px] truncate text-[9px] font-semibold tabular-nums leading-tight text-slate-500">
              Saldo {Math.round(card.totalPares).toLocaleString("es-PY")} {uStock}
            </p>
          ) : null}

          {showVentas ? (
            <CompradoresVentasSlot
              compradores={card.compradores}
              visible={expanded}
              resetKey={!expanded}
            />
          ) : null}

          {showDiccionarioBadge ? (
            <p
              className={`rounded-md border px-2 py-0.5 text-center text-[9px] font-bold uppercase leading-tight ${
                shell === "liquidacion"
                  ? "border-amber-500/50 bg-amber-50 text-amber-950"
                  : shell === "promo"
                    ? "border-fuchsia-400/60 bg-fuchsia-50 text-fuchsia-900"
                    : "border-slate-300 bg-slate-50 text-slate-700"
              }`}
            >
              {etiquetaCadenaPeUi(cadenaPeDeRow(p))}
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

          <div className="mt-auto shrink-0 pt-0.5">
            <GradaImportadoraAcordeon
              gradas={card.gradas}
              cardExpanded={expanded}
              resetKey={!expanded}
              showVentas={showVentas}
              modoConfecciones={esConf}
              tipoV2Id={p.tipo_v2_id}
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
