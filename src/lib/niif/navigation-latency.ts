/**
 * NIIF UI · Incidencia navegación Report
 * Índice: NIIF-NAV-LAT-500 (ext. 5.03.03.006 niif_estandar_visual)
 *
 * Regla: mostrar animación RIMEC solo si la transición o fetch supera este umbral
 * (evita flash en navegaciones rápidas).
 *
 * Excepción AM · ordenamiento KPI en `/herramienta-reposicion`:
 * overlay inmediato (delay 0 · entrada &lt; 0.5s) vía `RimecOrdenandoOverlay`
 * — el reorden de ~9k tarjetas puede tardar segundos; el usuario debe ver «ordenando» al click.
 */
export const NIIF_NAV_LATENCIA_MS = 500;

/** Entrada máxima deseada del overlay de ordenamiento AM (segundos → framer). */
export const NIIF_ORDEN_ENTRADA_MAX_MS = 500;

export type NiifNavPreset = {
  mensaje: string;
  subtitulo: string;
  etapas: string[];
};

export function niifNavPresetForPath(pathname: string): NiifNavPreset {
  if (pathname.startsWith("/herramienta-reposicion")) {
    return {
      mensaje: "Abriendo Alejandro Magno…",
      subtitulo: "Aguarde unos segundos, por favor.",
      etapas: [
        "Leyendo stock Pronta Entrega…",
        "Combinando CP y programado…",
        "Calculando niveles N1 · N2 · N3…",
        "Preparando tarjetas de reposición…",
      ],
    };
  }
  if (pathname.startsWith("/rimec")) {
    return {
      mensaje: "Abriendo Sales Report…",
      subtitulo: "RIMEC · informe ejecutivo blindado.",
      etapas: [
        "Conectando con la base operativa…",
        "Leyendo v_ventas_pivot…",
        "Calculando KPIs ejecutivos…",
        "Armando evolución mensual…",
      ],
    };
  }
  if (pathname.startsWith("/ventas-fotos")) {
    return {
      mensaje: "Abriendo Ventas con fotos…",
      subtitulo: "Aguarde unos segundos, por favor.",
      etapas: ["Cargando módulo…", "Preparando grilla…"],
    };
  }
  return {
    mensaje: "Cargando módulo RIMEC…",
    subtitulo: "Aguarde unos segundos, por favor.",
    etapas: ["Sincronizando…", "Preparando vista…"],
  };
}
