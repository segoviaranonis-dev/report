import type { CostosFiltrosDpe, CostosSimulacion, CostosTxtLinea, FilaMargenCalc } from "./types";
import { multListaCostos } from "./types";
import { factorDescuentosFiPct } from "@/lib/pedido-proveedor/aritmetica-programado";

/** Compara códigos pilar numéricamente si aplica; si no, texto natural. */
function cmpCodigoAsc(a: string, b: string): number {
  const na = Number(String(a).trim());
  const nb = Number(String(b).trim());
  const aNum = Number.isFinite(na) && String(a).trim() !== "";
  const bNum = Number.isFinite(nb) && String(b).trim() !== "";
  if (aNum && bNum && na !== nb) return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Orden canónico L+R+M+C · menor → mayor (paridad PDF stock PE). */
export function cmpCostosTxtLineaAsc(a: CostosTxtLinea, b: CostosTxtLinea): number {
  return (
    cmpCodigoAsc(a.linea, b.linea) ||
    cmpCodigoAsc(a.referencia, b.referencia) ||
    cmpCodigoAsc(a.material, b.material) ||
    cmpCodigoAsc(a.color, b.color)
  );
}

export function calcFilaMargen(linea: CostosTxtLinea, sim: CostosSimulacion): FilaMargenCalc {
  const mult = multListaCostos(sim.listaTier);
  const usdUnit = linea.dlsUsd;
  const costoFromUsd = usdUnit * sim.cotizUsd;
  const costoUnitGs = sim.baseCosto === "dls" ? costoFromUsd : linea.lpnGs;
  const precioListaGs = linea.lpnGs * mult;
  const factorDesc = factorDescuentosFiPct(
    sim.descuento1,
    sim.descuento2,
    sim.descuento3,
    sim.descuento4,
  );
  const precioVentaGs = precioListaGs * factorDesc;
  const margenGsPar = precioVentaGs - costoUnitGs;
  const margenPctVenta = precioVentaGs > 0 ? (margenGsPar / precioVentaGs) * 100 : 0;
  const margenPctCosto = costoUnitGs > 0 ? (margenGsPar / costoUnitGs) * 100 : 0;
  const margenPctLista = precioListaGs > 0 ? (margenGsPar / precioListaGs) * 100 : 0;
  const qty = Math.max(linea.qty, 0);

  return {
    linea,
    usdUnit,
    costoUnitGs,
    precioListaGs,
    precioVentaGs,
    margenGsPar,
    margenPctVenta,
    margenPctCosto,
    margenPctLista,
    encimaCosto: margenGsPar >= 0,
    gananciaStockGs: margenGsPar * qty,
    ganancia1000Gs: margenGsPar * Math.min(qty, 1000),
  };
}

export function applyCostosFiltros(
  lineas: CostosTxtLinea[],
  f: CostosFiltrosDpe,
): CostosTxtLinea[] {
  return lineas.filter((l) => {
    if (f.proveedor === "654" && l.proveedorId !== 654) return false;
    if (f.proveedor === "638" && l.proveedorId !== 638) return false;
    if (f.ramo && l.ramo !== f.ramo) return false;
    if (f.marcas.length && (!l.marca || !f.marcas.includes(l.marca))) return false;
    if (f.tipo1.length && (!l.tipo1 || !f.tipo1.includes(l.tipo1))) return false;
    if (f.cadena.length && (!l.cadena || !f.cadena.includes(l.cadena))) return false;
    return true;
  });
}

export function agregarPorCodigo(lineas: CostosTxtLinea[]): CostosTxtLinea[] {
  const map = new Map<string, CostosTxtLinea>();
  for (const l of lineas) {
    const prev = map.get(l.codigo);
    if (!prev) {
      map.set(l.codigo, { ...l });
      continue;
    }
    prev.qty += l.qty;
    prev.montoUsd += l.montoUsd;
  }
  return [...map.values()].sort(cmpCostosTxtLineaAsc);
}

export function totalesMargen(filas: FilaMargenCalc[]) {
  let pares = 0;
  let sumDescExtraMax = 0;
  let sumMargenPctLista = 0;
  for (const f of filas) {
    pares += f.linea.qty;
    sumDescExtraMax += f.margenPctVenta;
    sumMargenPctLista += f.margenPctLista;
  }
  const n = filas.length || 1;
  return {
    pares,
    skus: filas.length,
    promedioDescExtraMax: sumDescExtraMax / n,
    promedioGsParSobreLista: sumMargenPctLista / n,
    /** @deprecated alias — usar promedioDescExtraMax */
    promedioSobreCosto: sumDescExtraMax / n,
  };
}
