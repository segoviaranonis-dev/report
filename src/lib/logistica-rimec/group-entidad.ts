/**
 * Agrupación UI Logística Rimec (sin deps de BD).
 * Orden Director: PE → PROGRAMADO → CP · atraso DESC dentro del acordeón.
 */
import {
  ENTIDAD_AM_META,
  type EntidadAmLogistica,
} from "@/lib/logistica-ok/constants";
import {
  destinoListadoLogistica,
  groupLogisticaPorMarcaResumen,
  type LogisticaGrupoPedidoDuro,
  type LogisticaPendienteRow,
} from "@/lib/logistica-ok/queries-bandeja";

const RIMEC_ENTIDAD_ORDER: EntidadAmLogistica[] = ["PE", "PROGRAMADO", "CP"];

export function groupLogisticaRimecPorEntidad(
  filas: LogisticaPendienteRow[],
): LogisticaGrupoPedidoDuro[] {
  const map = new Map<EntidadAmLogistica, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const e = (f.entidad_am || "CP") as EntidadAmLogistica;
    const bucket = map.get(e) ?? [];
    bucket.push(f);
    map.set(e, bucket);
  }

  return RIMEC_ENTIDAD_ORDER.filter((e) => (map.get(e)?.length ?? 0) > 0).map((entidad_am) => {
    const rows = [...(map.get(entidad_am) ?? [])].sort(
      (a, b) =>
        (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0) ||
        String(a.factura_carlos || a.nro_factura || "").localeCompare(
          String(b.factura_carlos || b.nro_factura || ""),
        ),
    );
    const maxAtraso = rows.reduce((m, r) => Math.max(m, r.dias_atraso ?? 0), 0);
    const clientes = new Set(rows.map((r) => r.id_cliente));
    const bazzar = rows.filter((r) => destinoListadoLogistica(r) === "BAZZAR");
    const rimec = rows.filter((r) => destinoListadoLogistica(r) === "RIMEC");
    const label = ENTIDAD_AM_META[entidad_am]?.label ?? entidad_am;
    const bloque = (rs: LogisticaPendienteRow[]) => ({
      cajas: rs.reduce((s, r) => s + r.cajas, 0),
      pares: rs.reduce((s, r) => s + r.pares, 0),
      monto: rs.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
      n_fi: rs.length,
      n_clientes: new Set(rs.map((r) => r.id_cliente)).size,
      marcas: groupLogisticaPorMarcaResumen(rs),
    });
    const marcas = groupLogisticaPorMarcaResumen(rows).map((m) => ({
      ...m,
      filas: [...m.filas].sort((a, b) => (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0)),
    }));
    return {
      key: `rimec-entidad-${entidad_am}`,
      pedido_proveedor_id: 0,
      entidad_am,
      categoria_label: label,
      nro_pedido_externo: "",
      preventa_label: label,
      quincena_arribo_id: null,
      quincena_desc: label,
      quincena_corta: label,
      pp_numero: `${rows.length} facturas`,
      cajas: rows.reduce((s, r) => s + r.cajas, 0),
      pares: rows.reduce((s, r) => s + r.pares, 0),
      monto: rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
      n_fi: rows.length,
      n_clientes: clientes.size,
      marcas,
      stockBazzar: bloque(bazzar),
      stockRimec: bloque(rimec),
      cadenas: [],
      pp_publicado_at: rows[0]?.pp_publicado_at ?? null,
      dias_atraso: maxAtraso,
      n_inicial: rows.length,
      cajas_inicial: rows.reduce((s, r) => s + r.cajas, 0),
      pares_inicial: rows.reduce((s, r) => s + r.pares, 0),
      n_exitosas: 0,
      cajas_exitosas: 0,
      pct_ejecucion: 0,
      pct_cajas: 0,
    };
  });
}
