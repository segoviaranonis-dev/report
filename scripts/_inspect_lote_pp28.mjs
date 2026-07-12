import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const { getRimecPool } = await import("../src/lib/rimec/pool.ts");
const { loadAdministradorIcPp } = await import("../src/lib/pedido-proveedor/administrador-ic-query.ts");
const { construirParejasLoteChusa } = await import("../src/lib/pedido-proveedor/administrador-ic-monto.ts");
const { generarFiDesdeAdministradorIc } = await import("../src/lib/pedido-proveedor/administrador-ic-generar-fi.ts");

const ppId = 28;
const pool = getRimecPool();

const fiAntes = await pool.query(`SELECT count(*)::int c FROM factura_interna WHERE pp_id = $1`, [ppId]);
console.log("FI antes:", fiAntes.rows[0].c);

const data = await loadAdministradorIcPp(pool, ppId);
const lote = construirParejasLoteChusa(data.ics, data.prefacturas);
console.log("Chusa:", lote.chusa);
if (!lote.ok) {
  console.log("FAIL construir parejas:", lote.error);
  await pool.end();
  process.exit(1);
}
console.log("Parejas:", lote.parejas.length);

let ok = 0;
let fail = 0;
for (let i = 0; i < Math.min(3, lote.parejas.length); i++) {
  const p = lote.parejas[i];
  const r = await generarFiDesdeAdministradorIc(pool, ppId, p.ic_id, p.ppd_ids);
  if (r.ok) {
    ok++;
    console.log(`OK[${i}]`, p.ic_nro, r.fi_nro, r.total_pares, "p");
  } else {
    fail++;
    console.log(`FAIL[${i}]`, p.ic_nro, r.error);
    break;
  }
}

const fiDespues = await pool.query(`SELECT count(*)::int c FROM factura_interna WHERE pp_id = $1`, [ppId]);
console.log("FI despues:", fiDespues.rows[0].c, "| smoke ok/fail:", ok, fail);
await pool.end();
process.exit(fail > 0 ? 1 : 0);
