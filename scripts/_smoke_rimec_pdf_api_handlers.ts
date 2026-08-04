/**
 * Prueba handlers API /api/rimec/pdf y batch-pdf (sin middleware).
 */
import { NextRequest } from "next/server";
import { POST as postPdf } from "../src/app/api/rimec/pdf/route";
import { POST as postBatch } from "../src/app/api/rimec/batch-pdf/route";
import { ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, ALIAS_VARIATION } from "../src/modules/sales-report/constants";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

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
    Marca: "MOLECA",
    Cadena: "B",
    Cliente: "C2",
    Vendedor: "V2",
    [ALIAS_TARGET_VALUE]: 80000,
    [ALIAS_CURRENT_VALUE]: 70000,
    [ALIAS_VARIATION]: -12.5,
  },
];

async function main() {
  // PDF OK
  {
    const req = new NextRequest("http://localhost/api/rimec/pdf", {
      method: "POST",
      body: JSON.stringify({
        title: "Ranking de Marcas",
        rows,
        meta: { porcentaje: "20%", depto: "CALZADOS", periodo: "2026" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postPdf(req);
    assert(res.status === 200, `pdf status ${res.status}`);
    assert(res.headers.get("Content-Type") === "application/pdf", "ct pdf");
    const buf = new Uint8Array(await res.arrayBuffer());
    assert(buf[0] === 0x25 && buf[1] === 0x50, "magic PDF");
    console.log("PASS POST /api/rimec/pdf", buf.byteLength);
  }

  // PDF empty → 400
  {
    const req = new NextRequest("http://localhost/api/rimec/pdf", {
      method: "POST",
      body: JSON.stringify({ title: "x", rows: [] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postPdf(req);
    assert(res.status === 400, `empty expect 400 got ${res.status}`);
    console.log("PASS POST /api/rimec/pdf empty→400");
  }

  // Batch OK
  {
    const req = new NextRequest("http://localhost/api/rimec/batch-pdf", {
      method: "POST",
      body: JSON.stringify({
        titlePrefix: "Matriz de Marca",
        rows,
        batchCol: "Marca",
        groupCols: ["Marca", "Cadena", "Cliente", "Vendedor"],
        meta: { porcentaje: "20%", depto: "CALZADOS", periodo: "2026" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postBatch(req);
    assert(res.status === 200, `batch status ${res.status}`);
    assert(res.headers.get("Content-Type") === "application/zip", "ct zip");
    assert(res.headers.get("X-Rimec-Pdf-Count") === "2", "count 2");
    const buf = new Uint8Array(await res.arrayBuffer());
    assert(buf[0] === 0x50 && buf[1] === 0x4b, "magic ZIP");
    console.log("PASS POST /api/rimec/batch-pdf", buf.byteLength, "count", res.headers.get("X-Rimec-Pdf-Count"));
  }

  // Batch sin batchCol → 400
  {
    const req = new NextRequest("http://localhost/api/rimec/batch-pdf", {
      method: "POST",
      body: JSON.stringify({ titlePrefix: "x", rows, batchCol: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postBatch(req);
    assert(res.status === 400, `batchCol empty expect 400 got ${res.status}`);
    console.log("PASS POST /api/rimec/batch-pdf sin batchCol→400");
  }

  console.log("OK smoke API handlers PDF Sales Report");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
