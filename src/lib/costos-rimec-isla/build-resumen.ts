import type { CostosTxtArchivo, CostosTxtResumen } from "./types";

export function buildCostosTxtResumen(archivos: CostosTxtArchivo[]): CostosTxtResumen {
  const porDep = new Map<
    string,
    {
      deposito: string;
      archivos: string[];
      articulos: number;
      pares: number;
      montoUsd: number;
      valorLpnGs: number;
    }
  >();

  let articulos = 0;
  let pares = 0;
  let montoUsd = 0;
  let valorLpnGs = 0;

  for (const a of archivos) {
    articulos += a.articulos;
    pares += a.pares;
    montoUsd += a.montoUsd;
    valorLpnGs += a.valorLpnGs;
    const prev = porDep.get(a.depositoKey) ?? {
      deposito: a.depositoKey,
      archivos: [],
      articulos: 0,
      pares: 0,
      montoUsd: 0,
      valorLpnGs: 0,
    };
    prev.archivos.push(a.nombre);
    prev.articulos += a.articulos;
    prev.pares += a.pares;
    prev.montoUsd += a.montoUsd;
    prev.valorLpnGs += a.valorLpnGs;
    porDep.set(a.depositoKey, prev);
  }

  const depositosActivos = [...porDep.keys()].sort();

  return {
    archivos: archivos.length,
    depositosActivos,
    articulos,
    pares,
    montoUsd,
    valorLpnGs,
    porDeposito: [...porDep.values()].sort((x, y) => y.montoUsd - x.montoUsd),
  };
}
