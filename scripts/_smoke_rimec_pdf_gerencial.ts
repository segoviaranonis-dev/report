/**
 * Smoke PDF gerencial + batch ZIP (Sales Report).
 */
import { generateRimecGerencialPdf } from "../src/lib/rimec/pdf-gerencial";
import { generateRimecBatchZip } from "../src/lib/rimec/pdf-batch";
import { ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, ALIAS_VARIATION } from "../src/modules/sales-report/constants";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const rows = [
    {
      Marca: "VIZZANO",
      Cadena: "A",
      Cliente: "C1",
      Vendedor: "V1",
      [ALIAS_TARGET_VALUE]: 100000,
      [ALIAS_CURRENT_VALUE]: 120000,
      [ALIAS_VARIATION]: 20,
    },
    {
      Marca: "VIZZANO",
      Cadena: "A",
      Cliente: "C2",
      Vendedor: "V1",
      [ALIAS_TARGET_VALUE]: 80000,
      [ALIAS_CURRENT_VALUE]: 70000,
      [ALIAS_VARIATION]: -12.5,
    },
    {
      Marca: "MOLECA",
      Cadena: "B",
      Cliente: "C3",
      Vendedor: "V2",
      [ALIAS_TARGET_VALUE]: 50000,
      [ALIAS_CURRENT_VALUE]: 55000,
      [ALIAS_VARIATION]: 10,
    },
  ];

  const pdf = await generateRimecGerencialPdf({
    title: "Matriz de Marca: VIZZANO",
    rows: rows.filter((r) => r.Marca === "VIZZANO"),
    groupCols: ["Marca", "Cadena", "Cliente", "Vendedor"],
    meta: { porcentaje: "20%", depto: "CALZADOS", periodo: "2026", cat: "TODAS" },
  });
  assert(pdf.byteLength > 500, `PDF demasiado chico: ${pdf.byteLength}`);
  assert(pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46, "magic %PDF");

  const { zip, count } = await generateRimecBatchZip({
    titlePrefix: "Matriz de Marca",
    rows,
    batchCol: "Marca",
    groupCols: ["Marca", "Cadena", "Cliente", "Vendedor"],
    meta: { porcentaje: "20%", depto: "CALZADOS", periodo: "2026" },
  });
  assert(count === 2, `esperaba 2 PDF got ${count}`);
  assert(zip.byteLength > 800, `ZIP chico ${zip.byteLength}`);
  assert(zip[0] === 0x50 && zip[1] === 0x4b, "magic PK zip");

  console.log("OK smoke rimec pdf gerencial + batch", {
    pdfBytes: pdf.byteLength,
    zipBytes: zip.byteLength,
    count,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
