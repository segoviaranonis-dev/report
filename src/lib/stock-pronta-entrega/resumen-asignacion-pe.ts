/**
 * Verificación asignación descuentos PE — pivote por % + política comercial.
 */
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { moleculeKeyDescuentoPe } from "@/lib/stock-pronta-entrega/asignacion-descuento-local";
import { canonPeTipo1Valorizado } from "@/lib/filtros/pe-valorizado-tipo1";
import { PE_TIPO_DICCIONARIO_OPCIONES } from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import { cadenaPeCanonico } from "@/lib/stock-pronta-entrega/pe-grupo-uno-visual";

export type FilaPivotDescuento = {
  pct: number | null;
  label: string;
  count: number;
};

export type FilaVerificacionPolitica = {
  id: string;
  label: string;
  pctEsperado: number;
  total: number;
  asignadas: number;
  correctas: number;
  incorrectas: number;
  sinAsignar: number;
  ok: boolean;
};

export type MoleculaVerificacionPe = {
  key: string;
  row: DepositoRow;
  politicaId: string;
  politicaLabel: string;
  pctAsignado: number | null;
  /** Sugerido automático (DPE/política) — informativo; no bloquea si el usuario asignó otro %. */
  pctEsperado: number;
  /** true = hay % en BD · ratificado por usuario · válido factura. */
  ok: boolean;
  /** Asignado ≠ sugerido auto — aviso criterio, no invalida. */
  divergenciaCriterio: boolean;
  labels: {
    tipoDiccionario: string;
    tipoCadena: string;
    abcr: string;
    marca: string;
    estilo: string;
  };
};

export type VerificacionDescuentosPe = {
  totalMoleculas: number;
  asignadas: number;
  sinAsignar: number;
  /** Asignadas con % distinto al sugerido auto — informativo. */
  divergenciasCriterio: number;
  coberturaPct: number;
  pivotDescuento: FilaPivotDescuento[];
  verificacionPolitica: FilaVerificacionPolitica[];
  /** Solo sin asignar en BD — cola Revisar. */
  pendientes: MoleculaVerificacionPe[];
  /** Asignadas pero ≠ sugerido auto — aviso opcional. */
  divergencias: MoleculaVerificacionPe[];
};

/** Opciones % política — selector «¿A dónde agregar?». */
export const PCT_POLITICA_OPCIONES: ReadonlyArray<{ pct: number; label: string }> = [
  { pct: 40, label: "40% · Liquidaciones" },
  { pct: 30, label: "30% · Botas / Actvitta / Medias / Carteras" },
  { pct: 25, label: "25% · Stock abierto / cerrado" },
  { pct: 20, label: "20% · Confecciones normal" },
  { pct: 10, label: "10% · Promocional" },
  { pct: 0, label: "0% · Común" },
];

type PoliticaPe = {
  id: string;
  label: string;
  pctEsperado: number;
  orden: number;
};

const POLITICAS_ORDEN: PoliticaPe[] = [
  { id: "calz-normal", label: "Stock abierto / cerrado", pctEsperado: 25, orden: 1 },
  { id: "promo", label: "Stock cerrado promocional", pctEsperado: 10, orden: 2 },
  { id: "botas", label: "Stock botas", pctEsperado: 30, orden: 3 },
  { id: "actvitta-br", label: "Actvitta y BR Sport", pctEsperado: 30, orden: 4 },
  { id: "actvitta-ropas", label: "Actvitta ropas", pctEsperado: 30, orden: 5 },
  { id: "medias", label: "Medias Brasil", pctEsperado: 30, orden: 6 },
  { id: "carteras", label: "Carteras", pctEsperado: 30, orden: 7 },
  { id: "liq", label: "Liquidaciones", pctEsperado: 40, orden: 8 },
  { id: "conf-normal", label: "Confecciones normal", pctEsperado: 20, orden: 9 },
  { id: "comun", label: "Común", pctEsperado: 0, orden: 10 },
];

function normTxt(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function esConfecciones(row: DepositoRow): boolean {
  return row.tipo_v2_id === 2 || normTxt(String(row.tipo_v2 ?? "")).includes("CONF");
}

/** Política comercial esperada — la más específica gana (botas ≠ cerrado normal). */
export function resolvePoliticaPe(row: DepositoRow): PoliticaPe {
  const cadena = cadenaPeCanonico(row);
  const marca = normTxt(String(row.marca ?? row.sdrm_marca ?? ""));
  const estilo = normTxt(String(row.estilo ?? ""));
  const tipo1 = normTxt(String(row.tipo_1 ?? ""));

  if (cadena === "LIQUIDACION") return POLITICAS_ORDEN.find((p) => p.id === "liq")!;
  if (cadena === "PROMOCIONAL") return POLITICAS_ORDEN.find((p) => p.id === "promo")!;
  if (cadena === "COMUN") return POLITICAS_ORDEN.find((p) => p.id === "comun")!;

  if (!esConfecciones(row) && (estilo.includes("BOTAS") || estilo === "BOTA")) {
    return POLITICAS_ORDEN.find((p) => p.id === "botas")!;
  }
  if (marca.includes("MEDIA") || estilo.includes("MEDIA")) {
    return POLITICAS_ORDEN.find((p) => p.id === "medias")!;
  }
  if (estilo.includes("CARTERA") || tipo1.includes("CARTERA")) {
    return POLITICAS_ORDEN.find((p) => p.id === "carteras")!;
  }
  if (marca === "ACTVITTA" || marca.includes("BR SPORT") || marca === "BR SPORT") {
    if (esConfecciones(row)) return POLITICAS_ORDEN.find((p) => p.id === "actvitta-ropas")!;
    return POLITICAS_ORDEN.find((p) => p.id === "actvitta-br")!;
  }

  if (esConfecciones(row)) return POLITICAS_ORDEN.find((p) => p.id === "conf-normal")!;
  return POLITICAS_ORDEN.find((p) => p.id === "calz-normal")!;
}

/** Etiqueta estilo pilares — sidebar Revisar + política botas/medias. */
export function estiloLabelPe(row: DepositoRow): string {
  const raw = String(row.estilo ?? "").trim();
  return raw || "—";
}

/** Etiquetas visibles — paridad sidebar RIMEC Web (Tipo · AB-CR · Marca · Estilo). */
export function labelsMoleculaPe(row: DepositoRow): MoleculaVerificacionPe["labels"] {
  const cadena = cadenaPeCanonico(row);
  const tipoCadena = cadena === "REGULAR" ? "NORMAL" : cadena;
  const tipoOpt = PE_TIPO_DICCIONARIO_OPCIONES.find(
    (o) => o.cadena === cadena || (cadena === "REGULAR" && o.id === "normal"),
  );
  const abcrRaw = canonPeTipo1Valorizado(row.tipo_1 ?? "");
  return {
    tipoDiccionario: tipoOpt?.label ?? tipoCadena,
    tipoCadena,
    abcr: abcrRaw || "—",
    marca: String(row.marca ?? row.sdrm_marca ?? "—").trim() || "—",
    estilo: estiloLabelPe(row),
  };
}

function buildMoleculaItem(
  row: DepositoRow,
  key: string,
  pctAsignado: number | undefined,
): MoleculaVerificacionPe {
  const politica = resolvePoliticaPe(row);
  const pctEsperado = politica.pctEsperado;
  const pct =
    pctAsignado !== undefined && Number.isFinite(Number(pctAsignado))
      ? Number(pctAsignado)
      : null;
  const ratificado = pct != null;
  const divergenciaCriterio = ratificado && !pctIgual(pct, pctEsperado);
  return {
    key,
    row,
    politicaId: politica.id,
    politicaLabel: politica.label,
    pctAsignado: pct,
    pctEsperado,
    ok: ratificado,
    divergenciaCriterio,
    labels: labelsMoleculaPe(row),
  };
}

function pctIgual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function labelPct(pct: number | null): string {
  if (pct == null) return "Sin asignar";
  return `${pct}%`;
}

function ordenPivot(a: FilaPivotDescuento, b: FilaPivotDescuento): number {
  if (a.pct == null) return 1;
  if (b.pct == null) return -1;
  return b.pct - a.pct;
}

export function buildVerificacionDescuentosPe(
  rows: DepositoRow[],
  descMap: Map<string, number>,
): VerificacionDescuentosPe {
  const moleculas = new Map<string, MoleculaVerificacionPe>();

  for (const row of rows) {
    const key = moleculeKeyDescuentoPe(row);
    if (moleculas.has(key)) continue;
    const raw = descMap.get(key);
    moleculas.set(key, buildMoleculaItem(row, key, raw));
  }

  const pivotMap = new Map<number | "null", number>();
  const politicaAcc = new Map<string, FilaVerificacionPolitica>();

  for (const p of POLITICAS_ORDEN) {
    politicaAcc.set(p.id, {
      id: p.id,
      label: p.label,
      pctEsperado: p.pctEsperado,
      total: 0,
      asignadas: 0,
      correctas: 0,
      incorrectas: 0,
      sinAsignar: 0,
      ok: true,
    });
  }

  let asignadas = 0;
  let divergenciasCriterio = 0;
  const pendientes: MoleculaVerificacionPe[] = [];
  const divergencias: MoleculaVerificacionPe[] = [];

  for (const mol of moleculas.values()) {
    const { politicaId, pctAsignado, divergenciaCriterio } = mol;
    if (pctAsignado === null) pendientes.push(mol);
    else if (divergenciaCriterio) divergencias.push(mol);

    const pivotKey = pctAsignado === null ? "null" : pctAsignado;
    pivotMap.set(pivotKey, (pivotMap.get(pivotKey) ?? 0) + 1);

    const acc = politicaAcc.get(politicaId)!;
    acc.total += 1;
    if (pctAsignado === null) {
      acc.sinAsignar += 1;
      acc.ok = false;
    } else {
      asignadas += 1;
      acc.asignadas += 1;
      acc.correctas += 1;
      if (divergenciaCriterio) {
        divergenciasCriterio += 1;
        acc.incorrectas += 1;
      }
    }
  }

  const totalMoleculas = moleculas.size;
  const sinAsignar = totalMoleculas - asignadas;
  const coberturaPct =
    totalMoleculas > 0 ? Math.round((asignadas / totalMoleculas) * 1000) / 10 : 0;

  const pivotDescuento: FilaPivotDescuento[] = [...pivotMap.entries()]
    .map(([k, count]) => ({
      pct: k === "null" ? null : k,
      label: labelPct(k === "null" ? null : k),
      count,
    }))
    .sort(ordenPivot);

  const verificacionPolitica = POLITICAS_ORDEN.map((p) => politicaAcc.get(p.id)!)
    .filter((f) => f.total > 0)
    .map((f) => ({
      ...f,
      ok: f.sinAsignar === 0,
    }));

  return {
    totalMoleculas,
    asignadas,
    sinAsignar,
    divergenciasCriterio,
    coberturaPct,
    pivotDescuento,
    verificacionPolitica,
    pendientes,
    divergencias,
  };
}
