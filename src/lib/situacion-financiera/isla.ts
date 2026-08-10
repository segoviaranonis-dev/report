/**
 * Sit Fin = ISLA (faro de Alejandría) · 2.3.1.50.12
 *
 * Blindaje: este módulo NO consume resultados operativos de Nexus
 * (aprobaciones, ventas, IC/PP, bóveda de cobro viva, etc.).
 * Solo admite:
 *  - Intake propio (TXT ERP limpio · Excel admin referencia · clientes.xlsx tipo cobro)
 *  - Tablas maestras de coincidencia de claves (p.ej. cliente_cadena_v2) — sin lógica de negocio Nexus
 *
 * Integración con resultados Nexus = PROHIBIDA hasta etapa de implementación
 * y chequeo cerrados por el Director.
 */
export const SF_ISLA = {
  codigo: "2.3.1.50.12",
  nombre: "Faro de Alejandría · Situación Financiera",
  aislada: true as const,
  /** Prohibido enriquecer Sit Fin con corte/resultados operativos Nexus. */
  permitirCorteSupabaseOperativo: false as const,
  /** Prohibido usar módulos Nexus (aprobaciones, sales-report, etc.) como fuente de Gs. */
  permitirResultadosNexus: false as const,
  /** Permitido: tablas maestras solo para PK/FK (id_cliente ↔ cadena). */
  permitirTablasMaestras: true as const,
  ley:
    "Sit Fin navega sola (isla = Sales Report). Paralelo hoy. Integración Nexus solo cuando el holding esté maduro y el Director abra la puerta.",
} as const;

export function assertSfIslaNoResultadosNexus(contexto: string): void {
  if (SF_ISLA.permitirResultadosNexus) return;
  // Guardrail documental en runtime (dev): no lanza; deja traza clara.
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info(`[SF_ISLA] ${contexto} · solo intake + maestras · sin resultados Nexus`);
  }
}
