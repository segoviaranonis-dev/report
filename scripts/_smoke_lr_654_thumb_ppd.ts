/**
 * Smoke Admin LR 654 · thumb vía PPD (sin retail).
 * Uso: npx tsx scripts/_smoke_lr_654_thumb_ppd.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import { loadPrimeraImagenLineaReferencia } from "../src/lib/pilares/queries";

async function main() {
  const env = fs.readFileSync(".env.local", "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const pairs = [
      { linea_codigo: "7230", referencia_codigo: "100" },
      { linea_codigo: "7230", referencia_codigo: "101" },
      { linea_codigo: "7230", referencia_codigo: "102" },
      { linea_codigo: "7230", referencia_codigo: "103" },
    ];
    const map = await loadPrimeraImagenLineaReferencia(pool, pairs, 1);
    assert.equal(map.size, 4, "4 thumbs L×R");
    for (const p of pairs) {
      const t = map.get(`${p.linea_codigo}\0${p.referencia_codigo}`);
      assert.ok(t, `thumb ${p.referencia_codigo}`);
      assert.ok(t!.material_code?.trim(), `mat ${p.referencia_codigo}`);
      assert.ok(t!.color_code?.trim(), `col ${p.referencia_codigo}`);
    }
    console.log("PASS_654_THUMB_PPD", {
      "100": map.get(`7230\u0000100`),
      "101": map.get(`7230\u0000101`),
    });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
