import type { AnalisisNodo } from "@/app/api/depositos/[cliente_id]/analisis/route";

export const BAZZAR_CHART_COLORS = [
  "#ea580c",
  "#16a34a",
  "#002B4E",
  "#f97316",
  "#0ea5e9",
  "#8b5cf6",
  "#eab308",
  "#ec4899",
  "#64748b",
] as const;

const fmtInt = (n: number) =>
  Math.round(n).toLocaleString("es-PY", { maximumFractionDigits: 0 });

export { fmtInt };

/** Damas · Caballeros · otros — lenguaje tienda Bazzar adultos. */
export function normalizarGeneroTienda(label: string): string {
  const u = label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/DAMA|MUJER|FEMEN|NINA|WOMAN|DONNA|SENORA/.test(u)) return "Damas";
  if (/CABALLERO|HOMBRE|MASCUL|NINO|VARON|HOMB/.test(u)) return "Caballeros";
  if (/UNISEX|INFANT|NINO|NINA/.test(u)) return "Infantil / Unisex";
  return label.trim() || "Sin género";
}

export type GeneroSlice = { name: string; value: number; pct: number };

export function buildGeneroChart(
  arbol: AnalisisNodo[],
  soloConSaldo: boolean,
): { ente: string; slices: GeneroSlice[]; total: number } {
  const raiz = arbol[0];
  if (!raiz) return { ente: "Depósito", slices: [], total: 0 };

  const map = new Map<string, number>();
  for (const genero of raiz.hijos ?? []) {
    if (soloConSaldo && genero.saldo <= 0) continue;
    const key = normalizarGeneroTienda(genero.label);
    map.set(key, (map.get(key) ?? 0) + genero.saldo);
  }

  const total = [...map.values()].reduce((a, b) => a + b, 0);
  const slices: GeneroSlice[] = [...map.entries()]
    .map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return { ente: raiz.label, slices, total };
}

export type StackedRow = Record<string, string | number> & { label: string; total: number };

function topKeys(totals: Map<string, number>, limit: number): string[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/** Ente → Estilo → Marca — filas = estilo, barras apiladas = marca. */
export function buildEstiloMarcaChart(
  arbol: AnalisisNodo[],
  soloConSaldo: boolean,
  maxEstilos = 8,
  maxMarcas = 6,
): { ente: string; rows: StackedRow[]; seriesKeys: string[] } {
  const raiz = arbol[0];
  if (!raiz) return { ente: "Depósito", rows: [], seriesKeys: [] };

  const estilos = (raiz.hijos ?? []).filter((e) => !soloConSaldo || e.saldo > 0);
  const marcaGlobal = new Map<string, number>();

  for (const est of estilos) {
    for (const m of est.hijos ?? []) {
      if (soloConSaldo && m.saldo <= 0) continue;
      marcaGlobal.set(m.label, (marcaGlobal.get(m.label) ?? 0) + m.saldo);
    }
  }

  const topMarcas = topKeys(marcaGlobal, maxMarcas);
  const topMarcasSet = new Set(topMarcas);

  const rows: StackedRow[] = estilos
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, maxEstilos)
    .map((est) => {
      const row: StackedRow = { label: est.label, total: est.saldo };
      let otros = 0;
      for (const m of est.hijos ?? []) {
        if (soloConSaldo && m.saldo <= 0) continue;
        if (topMarcasSet.has(m.label)) {
          row[m.label] = (Number(row[m.label] ?? 0) + m.saldo) as number;
        } else {
          otros += m.saldo;
        }
      }
      if (otros > 0) row.Otros = otros;
      for (const k of topMarcas) {
        if (row[k] === undefined) row[k] = 0;
      }
      return row;
    });

  const seriesKeys = rows.some((r) => Number(r.Otros ?? 0) > 0)
    ? [...topMarcas, "Otros"]
    : topMarcas;

  return { ente: raiz.label, rows, seriesKeys };
}

/** Ente → Marca → Estilo — filas = marca, barras apiladas = estilo. */
export function buildMarcaEstiloChart(
  arbol: AnalisisNodo[],
  soloConSaldo: boolean,
  maxMarcas = 8,
  maxEstilos = 6,
): { ente: string; rows: StackedRow[]; seriesKeys: string[] } {
  const raiz = arbol[0];
  if (!raiz) return { ente: "Depósito", rows: [], seriesKeys: [] };

  const marcas = (raiz.hijos ?? []).filter((m) => !soloConSaldo || m.saldo > 0);
  const estiloGlobal = new Map<string, number>();

  for (const marca of marcas) {
    for (const e of marca.hijos ?? []) {
      if (soloConSaldo && e.saldo <= 0) continue;
      estiloGlobal.set(e.label, (estiloGlobal.get(e.label) ?? 0) + e.saldo);
    }
  }

  const topEstilos = topKeys(estiloGlobal, maxEstilos);
  const topEstilosSet = new Set(topEstilos);

  const rows: StackedRow[] = marcas
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, maxMarcas)
    .map((marca) => {
      const row: StackedRow = { label: marca.label, total: marca.saldo };
      let otros = 0;
      for (const e of marca.hijos ?? []) {
        if (soloConSaldo && e.saldo <= 0) continue;
        if (topEstilosSet.has(e.label)) {
          row[e.label] = (Number(row[e.label] ?? 0) + e.saldo) as number;
        } else {
          otros += e.saldo;
        }
      }
      if (otros > 0) row.Otros = otros;
      for (const k of topEstilos) {
        if (row[k] === undefined) row[k] = 0;
      }
      return row;
    });

  const seriesKeys = rows.some((r) => Number(r.Otros ?? 0) > 0)
    ? [...topEstilos, "Otros"]
    : topEstilos;

  return { ente: raiz.label, rows, seriesKeys };
}
