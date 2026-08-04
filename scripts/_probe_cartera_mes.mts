import { writeFileSync } from "fs";
import { generateRimecGerencialPdf } from "../src/lib/rimec/pdf-gerencial";
import { rowsCarteraCompleta } from "../src/lib/rimec/pdf-rows-from-snapshot";
import type { FullSnapshotResponse } from "../src/lib/rimec/full-snapshot-types";

const snap = {
  jerarquia_clientes: [
    {
      id_cadena: 1,
      descp_cadena: "Cadena X",
      id_cliente: 1,
      descp_cliente: "Cliente A",
      id_marca: 1,
      descp_marca: "VIZZANO",
      mes_idx: 1,
      monto_2025: 1,
      monto_2026: 100,
      monto_objetivo: 90,
      variacion_vs_objetivo_pct: 11,
    },
    {
      id_cadena: 1,
      descp_cadena: "Cadena X",
      id_cliente: 1,
      descp_cliente: "Cliente A",
      id_marca: 1,
      descp_marca: "VIZZANO",
      mes_idx: 2,
      monto_2025: 1,
      monto_2026: 50,
      monto_objetivo: 40,
      variacion_vs_objetivo_pct: 25,
    },
  ],
  clientes_crecimiento: [],
  clientes_riesgo: [],
  clientes_sin_compra: [],
} as unknown as FullSnapshotResponse;

const rows = rowsCarteraCompleta(snap);
console.log("keys", Object.keys(rows[0] ?? {}));
console.log(JSON.stringify(rows, null, 2));
const pdf = await generateRimecGerencialPdf({
  title: "Cartera Completa",
  rows,
  groupCols: ["Cadena", "Cliente", "Marca", "Mes"],
});
writeFileSync("tmp/smoke-pdf-rimec/02_cartera_mes.pdf", pdf);
console.log("pdf bytes", pdf.byteLength);
