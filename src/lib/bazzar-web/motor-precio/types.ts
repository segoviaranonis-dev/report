export type ReglaMarkup = {
  id: number;
  caso_codigo: string;
  markup_pct: number;
  descripcion: string | null;
  activo: boolean;
  updated_at: string | null;
};

export type CatalogoPrecioRow = {
  linea: string;
  referencia: string;
  /** Descripción material (UI). */
  material: string;
  /** Código proveedor material — naming imagen 654 L-R-M-C. */
  material_codigo: string | null;
  /** Color representante con stock — naming imagen 654. */
  color_codigo: string | null;
  descp_color: string | null;
  /**
   * Color Excel Kyly para stem 638 L_C (LEY 2.01.04.021).
   * Cadena: PE.color_code → F9 → PPD → nombre si token K/dígitos → codigo pilar.
   */
  imagen_color_excel: string | null;
  /** URL/stem PE real (paridad Depósito Web) — prioriza foto en thumb. */
  imagen_nombre: string | null;
  /** 1 calzado 654 · 2 confecciones 638 (desde linea.proveedor_id). */
  tipo_v2_id: number | null;
  tipo_v2: string | null;
  /** Dims cascada siamese (2.2.1.44 / 2.2.1.42) */
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  marca: string | null;
  genero: string | null;
  estilo: string | null;
  /** COD.GRUPO DPE del PE vivo — tipificación grupo uno */
  pe_cod_grupo: string | null;
  stock_pares: number;
  lpn: number | null;
  /** Etiqueta RIMEC: NORMAL | PROMOCIONAL | LIQUIDACION | COMUN | … */
  caso_precio: string | null;
  markup_pct: number | null;
  precio_rimec_lpn: number | null;
  precio_web_calculado: number | null;
  precio_web_publicado: number | null;
  /** true = fila en motor_precio_sello (puede ser huérfano). */
  motor_sellado: boolean;
  /**
   * true si algún precio WEB (histórico o vivo) de la tripleta L+R+M
   * igualó el sello — sello comercial real. false = sello huérfano (no cuenta).
   */
  sello_respaldado_web: boolean;
  /** Precio del último sello Motor (null si nunca publicó por Motor). */
  precio_motor_sellado: number | null;
  combinaciones: number;
  sin_precio: boolean;
};

export type SimularPrecioResult = {
  lpn: number;
  caso: string;
  markup_pct: number | null;
  precio_web: number | null;
};

export type PublicarPrecioResult = {
  ok: boolean;
  publicados: number;
  omitidos: number;
  error?: string;
};

/** Modo decisión 2.5.1.22 */
export type ModoPublicacionMotor = "nuevo" | "publicado";

export type EstadoPublicacionMotor = "pendiente_nuevo" | "pendiente_conflicto" | "publicado" | "sin_precio";

/** Comparación segura en guaraníes enteros (evita falsos ≠ por float). */
export function precioGsEq(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) {
    return false;
  }
  return Math.round(Number(a)) === Math.round(Number(b));
}

/** Sello con fila en tabla pero sin eco en lista WEB → no es publicación Motor real. */
export function selloMotorHuerfano(r: CatalogoPrecioRow): boolean {
  return Boolean(r.motor_sellado) && r.sello_respaldado_web === false;
}

/**
 * Estado comercial Motor · ley 2.5.1.22
 * - Sin sello válido → 1ª PUB. Precio WEB de Stock Sano NO es conflicto.
 * - Sello huérfano (nunca hubo WEB = sello) → se ignora · 1ª PUB.
 * - Con sello respaldado → CONFLICTO solo si calculado ≠ precio WEB publicado.
 */
export function estadoPublicacionMotor(r: CatalogoPrecioRow): EstadoPublicacionMotor {
  if (r.sin_precio || r.precio_web_calculado == null) return "sin_precio";
  const selloValido = Boolean(r.motor_sellado) && r.sello_respaldado_web !== false;
  if (!selloValido) return "pendiente_nuevo";
  const pub = r.precio_web_publicado;
  if (pub != null && !precioGsEq(r.precio_web_calculado, pub)) return "pendiente_conflicto";
  return "publicado";
}

/** Sello ≠ vitrina pero calculado = publicado → metadato viejo, no pelea comercial. */
export function selloMotorDesfasado(r: CatalogoPrecioRow): boolean {
  if (!r.motor_sellado || r.sello_respaldado_web === false) return false;
  if (r.precio_motor_sellado == null || r.precio_web_calculado == null) return false;
  if (r.precio_web_publicado == null) return false;
  return (
    precioGsEq(r.precio_web_calculado, r.precio_web_publicado) &&
    !precioGsEq(r.precio_motor_sellado, r.precio_web_calculado)
  );
}
