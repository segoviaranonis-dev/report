/** Filtros de indagación — Aprobaciones Nivel Dios (paridad CSV general). */
export type AprobacionesFiltros = {
  /** C. cliente */
  clienteIds: number[];
  /** Nombre cliente (multi) */
  clienteNombres: string[];
  /** Marca FI */
  marcas: string[];
  /** Usuario vendedor (multi texto) */
  vendedores: string[];
  /** C. Art. Prov — linea.referencia (654/638) */
  codigosArticulo: string[];
  /** GRUPO2 CSV — grupo_estilo_id DPE */
  codigosGrupoDpe: string[];
  /** Búsqueda parcial línea */
  lineaQ: string;
  /** Búsqueda parcial referencia */
  referenciaQ: string;
  /** PV000340 */
  pvGlobalQ: string;
  /** nro_factura / FI legacy */
  nroFacturaQ: string;
  /** ISO date YYYY-MM-DD */
  fechaDesde: string | null;
  /** ISO date YYYY-MM-DD */
  fechaHasta: string | null;
};

export const FILTROS_VACIOS: AprobacionesFiltros = {
  clienteIds: [],
  clienteNombres: [],
  marcas: [],
  vendedores: [],
  codigosArticulo: [],
  codigosGrupoDpe: [],
  lineaQ: "",
  referenciaQ: "",
  pvGlobalQ: "",
  nroFacturaQ: "",
  fechaDesde: null,
  fechaHasta: null,
};

export type AprobacionesFiltrosOpciones = {
  clientes: { id: number; nombre: string }[];
  marcas: string[];
  vendedores: string[];
  codigosArticulo: string[];
  codigosGrupoDpe: { id: string; label: string }[];
};

export function filtrosActivos(f: AprobacionesFiltros): boolean {
  return (
    f.clienteIds.length > 0 ||
    f.clienteNombres.length > 0 ||
    f.marcas.length > 0 ||
    f.vendedores.length > 0 ||
    f.codigosArticulo.length > 0 ||
    f.codigosGrupoDpe.length > 0 ||
    Boolean(f.lineaQ.trim()) ||
    Boolean(f.referenciaQ.trim()) ||
    Boolean(f.pvGlobalQ.trim()) ||
    Boolean(f.nroFacturaQ.trim()) ||
    Boolean(f.fechaDesde) ||
    Boolean(f.fechaHasta)
  );
}
