import fs from "fs";
import { opcionesFiltroFromLineas } from "../src/lib/costos-rimec-isla/dpe-from-grupo";
import {
  agregarPorCodigo,
  applyCostosFiltros,
  calcFilaMargen,
  totalesMargen,
} from "../src/lib/costos-rimec-isla/margen-calculo";
import { buildArchivoFromTxt } from "../src/lib/costos-rimec-isla/parse-ifstgp4-txt";
import { buildCostosTxtResumen } from "../src/lib/costos-rimec-isla/build-resumen";

const paths = ["Z:\\hector\\23980722.txt", "Z:\\hector\\23956181.txt"];

const archivos = paths.map((p) =>
  buildArchivoFromTxt(p.split(/[/\\]/).pop()!, fs.readFileSync(p, "latin1")),
);
const res = buildCostosTxtResumen(archivos);

console.log("=== ARCHIVOS ===");
for (const a of archivos) {
  console.log(
    `${a.nombre} | ${a.depositoCabecera} | slot ${a.depositoSlot} | arts ${a.articulos} | pares ${Math.round(a.pares)} | USD ${a.montoUsd.toFixed(2)}`,
  );
}
console.log("=== TOTAL ===", JSON.stringify(res, null, 0));
const lineas = agregarPorCodigo(archivos.flatMap((a) => a.lineas));
console.log("=== OPCIONES ===", opcionesFiltroFromLineas(lineas));
const beiraMoleca = applyCostosFiltros(lineas, {
  ramo: "",
  marcas: ["BEIRA RIO", "MOLECA"],
  tipo1: [],
  cadena: [],
});
const sim = {
  listaTier: "LPC03" as const,
  descuento1: 4,
  descuento2: 50,
  descuento3: 0,
  descuento4: 0,
  cotizUsd: 7500,
  baseCosto: "lpn" as const,
};
const filas = beiraMoleca.map((l) => calcFilaMargen(l, sim));
const tot = totalesMargen(filas);
console.log(
  "=== BEIRA+MOLECA LPC03 50% ===",
  `skus ${filas.length}`,
  `pares ${Math.round(tot.pares)}`,
  `promSobreCosto ${tot.promedioSobreCosto.toFixed(1)}%`,
  `promGsPar/LP ${tot.promedioGsParSobreLista.toFixed(1)}%`,
  `ganStock ${Math.round(tot.gananciaStock)}`,
);
const sample = filas.slice(0, 3).map((f) => ({
  cod: f.linea.codigo,
  marca: f.linea.marca,
  encima: f.encimaCosto,
  margenPct: f.margenPctCosto.toFixed(1),
}));
console.log("=== SAMPLE ===", sample);
