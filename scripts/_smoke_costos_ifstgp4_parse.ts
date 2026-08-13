/**
 * Smoke parser ifstgp4 — isla costos · formato Carlos real.
 */
import { buildArchivoFromTxt } from "../src/lib/costos-rimec-isla/parse-ifstgp4-txt";
import { parseLineaReferenciaFromDesc } from "../src/lib/costos-rimec-isla/molecule-label";
import { calcFilaMargen } from "../src/lib/costos-rimec-isla/margen-calculo";

const lrAct = parseLineaReferenciaFromDesc("ACTIVITTA 40004.6 ALGODAO BLANCO 99", 1);
if (lrAct.linea !== "40004" || lrAct.referencia !== "6") {
  console.error("FAIL L+R ref 1 digito", lrAct);
  process.exit(1);
}

const SAMPLE = `
DEPOSITO: S00_D1
BEIRA RIO ABIERTO LIQUIDACION
 654.123456            BEIRA RIO 4076.1350 NAPA DEMO NEGRO             A 34-39 OTR
 A          9569       15745            8.38 Dls          6,980   P.F.A      17909882691194         12 05/08/2026       4740                      654 CR-150       0.000   0.000   0.000   0.000             7.330        144,400                        6
MOLECA CERRADO REGULAR
 638.999001            KYLY 206210 BLUSA FEM BRANCO - TAM 4 I/26
 4          K206210    K0001            2.46 Dls          6,383   OK2026     7909293127681           1 17/04/2026       4612 3017/26/3K           638 CR-150       0.000   0.000   0.000   0.000             2.330         44,400                       10
`;

const arch = buildArchivoFromTxt("lab.txt", SAMPLE);
const a654 = arch.lineas.find((x) => x.codigo === "654.123456");
if (!a654 || a654.qty !== 6 || a654.marca !== "BEIRA RIO") {
  console.error("FAIL 654", a654);
  process.exit(1);
}
if (a654.linea !== "4076" || a654.referencia !== "1350" || a654.material !== "9569") {
  console.error("FAIL pilares 654", a654);
  process.exit(1);
}

const a638 = arch.lineas.find((x) => x.codigo === "638.999001");
if (!a638 || a638.proveedorId !== 638 || a638.linea !== "206210") {
  console.error("FAIL 638", a638);
  process.exit(1);
}
if (a638.referencia !== "11" || a638.grada !== "4") {
  console.error("FAIL 638 ref/grada", a638);
  process.exit(1);
}

if (arch.depositoSlot !== "D1" || arch.pares !== 16) {
  console.error("FAIL cabecera", arch);
  process.exit(1);
}

const margen = calcFilaMargen(a654, {
  listaTier: "LPC03",
  descuento1: 0,
  descuento2: 50,
  descuento3: 0,
  descuento4: 0,
  cotizUsd: 7500,
  baseCosto: "dls",
});
// costo = 7.33*7500 = 54975; LPC03 50% = 80864 → encima costo
if (margen.encimaCosto !== true || margen.usdUnit !== 7.33 || margen.margenGsPar <= 0) {
  console.error("FAIL margen 50% LPC03 dls", margen);
  process.exit(1);
}

console.log("PASS smoke costos isla · pilares · 654/638 · margen");
