import type { Pool } from "pg";
import { aplicarBibliotecaAEvento } from "./evento-biblioteca";
import { auditarCoberturaCasos } from "./evento-paso3";
import { getPrecioEventoDetalle } from "./evento-queries";
import { contarSkusExcel } from "./evento-sku-staging";

export type PreviewAuditSku = {
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  motivo: string;
};

export type PreviewAuditLinea = {
  marca: string;
  linea_codigo: string;
  skus_afectados: number;
  motivo: string;
};

export type PreviewAuditResult = {
  ok: boolean;
  evento_id: number;
  biblioteca_id: number | null;
  casos_count: number;
  skus_excel: number;
  skus_con_caso: number;
  skus_sin_caso: number;
  lineas_sin_caso: number;
  matriz_sincronizada: boolean;
  lineas_huerfanas: PreviewAuditLinea[];
  /** @deprecated Usar lineas_huerfanas — detalle SKU para debug */
  skus_huerfanos: PreviewAuditSku[];
  warnings: string[];
  error?: string;
};

/** Paso Preview — Excel × casos de biblioteca (sin calcular precio_lista). */
export async function auditarPreviewEvento(pool: Pool, eventoId: number): Promise<PreviewAuditResult> {
  const evento = await getPrecioEventoDetalle(pool, eventoId);
  if (!evento) {
    return {
      ok: false,
      evento_id: eventoId,
      biblioteca_id: null,
      casos_count: 0,
      skus_excel: 0,
      skus_con_caso: 0,
      skus_sin_caso: 0,
      lineas_sin_caso: 0,
      matriz_sincronizada: false,
      lineas_huerfanas: [],
      skus_huerfanos: [],
      warnings: [],
      error: "Evento no encontrado",
    };
  }

  const bibId = evento.biblioteca_precio_id;
  if (!bibId) {
    return {
      ok: false,
      evento_id: eventoId,
      biblioteca_id: null,
      casos_count: 0,
      skus_excel: evento.matriz.excel_skus_count,
      skus_con_caso: 0,
      skus_sin_caso: evento.matriz.excel_skus_count,
      lineas_sin_caso: 0,
      matriz_sincronizada: false,
      lineas_huerfanas: [],
      skus_huerfanos: [],
      warnings: ["Asigná biblioteca en Memoria (Paso 1)."],
      error: "Sin biblioteca asignada",
    };
  }

  let matrizSincronizada = (evento.matriz.casos_count ?? 0) > 0;
  const warnings: string[] = [];

  if (!matrizSincronizada && String(evento.estado).toLowerCase() !== "cerrado") {
    const sync = await aplicarBibliotecaAEvento(
      pool,
      eventoId,
      evento.proveedor_id,
      bibId,
      true,
    );
    if (!sync.ok) {
      return {
        ok: false,
        evento_id: eventoId,
        biblioteca_id: bibId,
        casos_count: 0,
        skus_excel: evento.matriz.excel_skus_count,
        skus_con_caso: 0,
        skus_sin_caso: evento.matriz.excel_skus_count,
        lineas_sin_caso: 0,
        matriz_sincronizada: false,
        lineas_huerfanas: [],
        skus_huerfanos: [],
        warnings: [],
        error: sync.error,
      };
    }
    matrizSincronizada = true;
    warnings.push(`${sync.n_casos} casos sincronizados desde biblioteca #${bibId}.`);
  }

  const [skusExcel, cobertura] = await Promise.all([
    contarSkusExcel(pool, eventoId),
    auditarCoberturaCasos(pool, eventoId),
  ]);

  const huerfanos: PreviewAuditSku[] = cobertura.huerfanos.map((r) => ({
    ...r,
    motivo: "Sin caso en matriz biblioteca",
  }));

  const lineasHuerfanas: PreviewAuditLinea[] = cobertura.lineas_huerfanas.map((r) => ({
    ...r,
    motivo: "Sin caso en matriz biblioteca (pilar línea)",
  }));

  const refreshed = await getPrecioEventoDetalle(pool, eventoId);

  return {
    ok: cobertura.skus_sin_caso === 0 && skusExcel > 0 && (refreshed?.matriz.casos_count ?? 0) > 0,
    evento_id: eventoId,
    biblioteca_id: bibId,
    casos_count: refreshed?.matriz.casos_count ?? 0,
    skus_excel: skusExcel || cobertura.skus_total,
    skus_con_caso: cobertura.skus_con_caso,
    skus_sin_caso: cobertura.skus_sin_caso,
    lineas_sin_caso: cobertura.lineas_sin_caso,
    matriz_sincronizada: matrizSincronizada,
    lineas_huerfanas: lineasHuerfanas,
    skus_huerfanos: huerfanos,
    warnings: [...warnings, ...cobertura.warnings].slice(0, 30),
  };
}
