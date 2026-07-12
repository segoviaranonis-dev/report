import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { EMPTY_OPERATIVA_FILTERS, type OperativaFilterState } from "@/lib/depositos/operativa-filters";
import type { StockTransitoResumen } from "./queries-resumen";

export type TransitoVitalesModo = "canonico" | "filtrado";

export type TransitoVitales = {
  inicial: number;
  vendidos: number;
  saldo: number;
  modo: TransitoVitalesModo;
};

export function operativaFiltersActive(f: OperativaFilterState): boolean {
  return (
    f.generoIds.length > 0 ||
    f.marcaIds.length > 0 ||
    f.grupoEstiloIds.length > 0 ||
    f.tipo1Ids.length > 0 ||
    f.tipoV2Ids.length > 0 ||
    f.lineaIds.length > 0 ||
    f.tonos.length > 0 ||
    f.sinTono ||
    Boolean(f.q?.trim()) ||
    f.cantidadOp != null ||
    f.gradas.length > 0
  );
}

function sumFromRows(rows: DepositoRow[]): Omit<TransitoVitales, "modo"> {
  let inicial = 0;
  let vendidos = 0;
  let saldo = 0;
  for (const p of rows) {
    inicial += p.cantidad_inicial ?? p.cantidad;
    vendidos += p.pares_vendidos ?? 0;
    saldo += p.cantidad;
  }
  return { inicial, vendidos, saldo };
}

/**
 * KPIs vitales Stock Tránsito.
 * Canónico = RIMEC Web Estadísticas (incluye moléculas agotadas saldo=0).
 * Filtrado = suma grilla visible (solo saldo>0 + filtros UI).
 */
export function resolveTransitoVitales(opts: {
  resumen: StockTransitoResumen;
  quincenaIds: string[];
  ppIds?: string[];
  porProforma?: { pp_id: number; pares_inicial: number; pares_vendidos: number; pares_saldo: number }[];
  casoActivo: string | null;
  filtros: OperativaFilterState;
  filtradas: DepositoRow[];
  filtradasCaso: DepositoRow[];
}): TransitoVitales {
  const { resumen, quincenaIds, ppIds = [], porProforma = [], casoActivo, filtros, filtradas, filtradasCaso } =
    opts;

  if (!casoActivo && !operativaFiltersActive(filtros)) {
    if (ppIds.length > 0 && porProforma.length > 0) {
      const set = new Set(ppIds);
      const selected = porProforma.filter((p) => set.has(String(p.pp_id)));
      if (selected.length) {
        return {
          inicial: selected.reduce((s, q) => s + q.pares_inicial, 0),
          vendidos: selected.reduce((s, q) => s + q.pares_vendidos, 0),
          saldo: selected.reduce((s, q) => s + q.pares_saldo, 0),
          modo: "canonico",
        };
      }
    }
    if (quincenaIds.length > 0) {
      const set = new Set(quincenaIds);
      const selected = resumen.por_quincena.filter((q) => set.has(String(q.quincena_arribo_id)));
      if (selected.length) {
        return {
          inicial: selected.reduce((s, q) => s + q.pares_inicial, 0),
          vendidos: selected.reduce((s, q) => s + q.pares_vendidos, 0),
          saldo: selected.reduce((s, q) => s + q.pares_saldo, 0),
          modo: "canonico",
        };
      }
    } else {
      return {
        inicial: resumen.pares_inicial,
        vendidos: resumen.pares_vendidos,
        saldo: resumen.pares_saldo,
        modo: "canonico",
      };
    }
  }

  const rows = casoActivo ? filtradasCaso : filtradas;
  return { ...sumFromRows(rows), modo: "filtrado" };
}

export function isOperativaFiltersDefault(f: OperativaFilterState): boolean {
  return !operativaFiltersActive(f) && f === EMPTY_OPERATIVA_FILTERS;
}
