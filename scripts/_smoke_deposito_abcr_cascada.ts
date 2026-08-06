import { getDepositoRowsIngreso } from "../src/lib/bazzar-web/deposito-web/deposito-web-rows";
import {
  buildStockPeOpciones,
  applyStockPeFilters,
} from "../src/lib/stock-pronta-entrega/stock-pe-filters";
import { EMPTY_OPERATIVA_FILTERS } from "../src/lib/depositos/operativa-filters";

async function main() {
  const rows = await getDepositoRowsIngreso();
  const conT1 = rows.filter((r) => r.tipo_1_id != null).length;
  const conCg = rows.filter((r) => r.cod_grupo).length;
  console.log(JSON.stringify({ total: rows.length, conT1, conCg }));
  const op = buildStockPeOpciones(rows, EMPTY_OPERATIVA_FILTERS, "");
  console.log(
    "ABCR",
    op.tipo1.map((t) => `${t.label}:${t.id}`).slice(0, 12),
  );
  console.log(
    "CERRADO",
    applyStockPeFilters(rows, { ...EMPTY_OPERATIVA_FILTERS, tipo1Ids: [2] }, "").length,
  );
  console.log(
    "ABIERTO",
    applyStockPeFilters(rows, { ...EMPTY_OPERATIVA_FILTERS, tipo1Ids: [1] }, "").length,
  );
  const marca = rows.find((r) => r.marca_id != null)?.marca_id;
  if (marca != null) {
    const opMarca = buildStockPeOpciones(
      rows,
      { ...EMPTY_OPERATIVA_FILTERS, marcaIds: [marca] },
      "",
    );
    console.log(
      "cascada marca→líneas",
      opMarca.lineas.length,
      "vs universo",
      op.lineas.length,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
