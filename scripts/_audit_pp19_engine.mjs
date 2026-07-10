import fs from "fs";
import pg from "pg";
import { diagnoseProgramadoFiPlan } from "../src/lib/pedido-proveedor/proforma-programado-engine.ts";

const ppId = Number(process.argv[2] ?? 28);
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
process.env.DATABASE_URL = url;

const d = await diagnoseProgramadoFiPlan(ppId);
console.log(JSON.stringify(d, null, 2));

const pool = new pg.Pool({ connectionString: url });
const profBrand = await pool.query(
  `SELECT COUNT(*) FILTER (WHERE COALESCE(f->>'brand','') = '')::int AS sin_brand,
          COUNT(*)::int AS total
   FROM pp_proforma_filas pf, jsonb_array_elements(pf.filas) f WHERE pf.pp_id = $1`,
  [ppId],
);
console.log("\nProforma snapshot brands vacíos:", profBrand.rows[0]);

await pool.end();
