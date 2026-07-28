/**
 * Logística OK — lexicono y tokens UI (2.3.1.28 / 2.3.1.28.5)
 * Doc: CHUSAR_LOGISTICA_OK_PLAN_OPERATIVO_PESTANAS_20260723.md
 * Palabra reservada Factura Real → lib/logistica-ok/factura-real.ts
 */

export { FACTURA_REAL_LABEL, FI_NEXUS_LABEL } from "./factura-real";

/**
 * Palabra reservada (2.3.1.28.0 / plan PE→Logística):
 * UI «Fecha de entrega Real» = BD pedido_proveedor.fecha_arribo_real = API fecha_entrega_real.
 */
export const FECHA_ENTREGA_REAL_LABEL = "Fecha de entrega Real" as const;

/** Alias UI PP — misma verdad que Fecha de entrega Real. */
export const FECHA_LLEGADA_PP_LABEL = FECHA_ENTREGA_REAL_LABEL;

/** FI / pendiente · columna fecha_entrega_vendedor */
export const FECHA_ENTREGA_CLIENTE_LABEL = "Fecha de entrega al cliente" as const;

/** @deprecated alias — usar FECHA_ENTREGA_CLIENTE_LABEL */
export const FECHA_ENTREGA_VENDEDOR_LABEL = FECHA_ENTREGA_CLIENTE_LABEL;

export const FECHA_ENTREGA_EFECTIVA_LABEL = "Fecha de la entrega" as const;

export type EntidadAmLogistica = "CP" | "PE" | "PROGRAMADO";

export const ENTIDAD_AM_META: Record<
  EntidadAmLogistica,
  { label: string; color: string; sortPriority: number }
> = {
  PE: { label: "Pronta entrega", color: "#059669", sortPriority: 0 },
  CP: { label: "Compra previa", color: "#002B4E", sortPriority: 1 },
  PROGRAMADO: { label: "Programado", color: "#6D28D9", sortPriority: 2 },
};

export type LogisticaTabId =
  | "general"
  | "general_exitoso"
  | "vendedor"
  | "confirmadas"
  | "entregas"
  | "exitosas";

export const LOGISTICA_TABS: Array<{ id: LogisticaTabId; label: string; hint: string }> = [
  { id: "general", label: "General", hint: "Nivel Dios · pendientes" },
  {
    id: "general_exitoso",
    label: "General exitoso",
    hint: "Nivel Dios · EXITOSA",
  },
  { id: "vendedor", label: "Vendedor", hint: "Solo usuarios VENDEDOR" },
  { id: "confirmadas", label: "Confirmadas", hint: "Facturación / ADMIN" },
  { id: "entregas", label: "Entregas del día", hint: "Logística depósito" },
  { id: "exitosas", label: "Registro exitosas", hint: "Logística depósito · por chofer" },
];

/**
 * Segregación pestañas Logística OK (Director 2026-07-24 · EVERT 2026-07-27):
 * - General + General exitoso → DIOS
 * - Vendedor → VENDEDOR
 * - Confirmadas → ADMIN (facturación / otro depto)
 * - Entregas + Exitosas → LOGISTICA | DEPOSITO
 * - JEFE_DEPOSITO (EVERT): hub 2 tarjetas (Depósito + Logística) · Confirmadas + Entregas + Exitosas
 * - VENDEDOR (rol 1 o legado rol 3): solo pestaña Vendedor · filtrado a su id_vendedor
 * - Vendedores sin usuario (ej. DARIO): los ve la jefa (DIOS/ADMIN General)
 * - DIOS ve todas (Nivel Superior sin restricciones)
 */
export type LogisticaCategoriaAcl =
  | "DIOS"
  | "ADMIN"
  | "VENDEDOR"
  | "LOGISTICA"
  | "DEPOSITO"
  | "JEFE_DEPOSITO"
  | string;

/** Tres pestañas depósito — perfil JEFE_DEPOSITO (EVERT y similares). */
export const LOGISTICA_TABS_JEFE_DEPOSITO: LogisticaTabId[] = [
  "confirmadas",
  "entregas",
  "exitosas",
];

export function tabsPermitidasLogistica(categoria: string | null | undefined): LogisticaTabId[] {
  const cat = (categoria || "").toUpperCase().trim();
  if (cat === "DIOS") return LOGISTICA_TABS.map((t) => t.id);
  if (cat === "VENDEDOR") return ["vendedor"];
  if (cat === "ADMIN") return ["confirmadas"];
  if (cat === "JEFE_DEPOSITO") return [...LOGISTICA_TABS_JEFE_DEPOSITO];
  if (cat === "LOGISTICA" || cat === "DEPOSITO") return ["entregas", "exitosas"];
  // Sin categoría conocida: ninguna pestaña operativa
  return [];
}

export function puedeVerTabLogistica(
  tab: LogisticaTabId,
  categoria: string | null | undefined,
): boolean {
  return tabsPermitidasLogistica(categoria).includes(tab);
}

export function tabInicialLogistica(categoria: string | null | undefined): LogisticaTabId {
  const cat = (categoria || "").toUpperCase().trim();
  if (cat === "JEFE_DEPOSITO") return "entregas";
  return tabsPermitidasLogistica(categoria)[0] ?? "general";
}

export function statsObsMensajes(filas: Array<{ obs_count: number; obs_no_leida?: boolean }>): {
  conObs: number;
  abiertos: number;
  label: string;
} {
  const conObs = filas.filter((f) => f.obs_count > 0).length;
  const abiertos = filas.filter((f) => f.obs_count > 0 && f.obs_no_leida).length;
  return {
    conObs,
    abiertos,
    label: `${conObs}/${abiertos} mensajes abiertos`,
  };
}

export type LogisticaEstadoFila = "PENDIENTE" | "CONFIRMADA" | "EN_ENTREGA" | "EXITOSA";

export type SemaforoColor = "rojo" | "amarillo" | "verde" | "apagado";

/** Tres pelotas del embudo por FI */
export type SemaforoPaso = 1 | 2 | 3;

export type SemaforoPelotas = {
  p1: SemaforoColor; // fecha confirmación
  p2: SemaforoColor; // impresión legal
  p3: SemaforoColor; // depósito / entrega
};

/**
 * Sin fecha (o basura 0020-…): 🔴 apagado apagado — aún en confirmación
 * Con fecha válida: 🟢 🟡 🟡
 * Legal OK: 🟢 🟢 🟡
 * Exitosa: 🟢 🟢 🟢
 *
 * Ley Director: fechas agrupan; pelotas marcan el proceso sin fallas.
 * Año &lt; 2000 (carrito) = sin fecha.
 */
export function fechaEntregaClienteValida(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (Number(d.slice(0, 4)) < 2000) return null;
  return d;
}

export function pelotasDesdeFila(input: {
  estado: string;
  fecha_entrega_cliente?: string | null;
  impresion_legal_ok?: boolean;
  entregado_ok?: boolean;
}): SemaforoPelotas {
  const fechaOk = fechaEntregaClienteValida(input.fecha_entrega_cliente);
  if (input.entregado_ok || input.estado === "EXITOSA") {
    return { p1: "verde", p2: "verde", p3: "verde" };
  }
  if (input.estado === "EN_ENTREGA" || input.impresion_legal_ok) {
    return { p1: "verde", p2: "verde", p3: "amarillo" };
  }
  // Confirmación = acto con fecha real · basura 0020 no cuenta
  if (input.estado === "CONFIRMADA" || fechaOk) {
    return { p1: "verde", p2: "amarillo", p3: "amarillo" };
  }
  return { p1: "rojo", p2: "apagado", p3: "apagado" };
}

/** @deprecated preferir pelotasDesdeFila */
export function semaforoLogistica(input: {
  estado: string;
  fecha_entrega_cliente?: string | null;
  impresion_legal_ok?: boolean;
  entregado_ok?: boolean;
}): SemaforoColor {
  const p = pelotasDesdeFila(input);
  if (p.p3 === "verde") return "verde";
  if (p.p1 === "rojo") return "rojo";
  return "amarillo";
}

export const SEMAFORO_META: Record<SemaforoColor, { label: string; bg: string; emoji: string }> = {
  rojo: { label: "Sin fecha cliente", bg: "#DC2626", emoji: "🔴" },
  amarillo: { label: "Pendiente depto", bg: "#D97706", emoji: "🟡" },
  verde: { label: "Listo", bg: "#059669", emoji: "🟢" },
  apagado: { label: "Aún no", bg: "#CBD5E1", emoji: "⚪" },
};

export const SEMAFORO_PASO_LABEL: Record<SemaforoPaso, string> = {
  1: "Fecha cliente",
  2: "Impresión legal",
  3: "Entrega depósito",
};

/** Arranque catálogo choferes (RRHH / funcionarios RIMEC · LOGISTICA) */
export const CHOFERES_RIMEC_INICIAL = [
  "Oscar Figueredo",
  "Ariel Martínez",
  "Gilberto Colman",
  /** RRHH id_funcionario 72 · JULIAN ROTELA DOMINGUEZ · AUXILIAR LOGISTICA */
  "Julian Rotela",
  /** RRHH id_funcionario 68 · GERARDO DOMINGUEZ RIVEROS · CHOFER */
  "Gerardo Dominguez",
] as const;

export const LOGISTICA_PENDIENTE_TABLE = "logistica_pendiente_confirmacion" as const;
