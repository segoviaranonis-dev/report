import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const sql = fs.readFileSync("migrations/178_fn_precio_tier_centena_paridad_web.sql", "utf8");
const pool = new pg.Pool({ connectionString: url });
await pool.query(sql);
const t = await pool.query(
  `SELECT fn_precio_tier_vista(3, 113400, null, null, null, 'REGULAR') AS lpc03`,
);
console.log("113400 LPN -> LPC03:", t.rows[0]);
const d = await pool.query(
  `SELECT fn_precio_tier_vista(3, lpn, lpc02, lpc03, lpc04, descp_caso) AS tier3, lpn
   FROM v_stock_rimec WHERE det_id = 563`,
);
console.log("det 563:", d.rows[0]);
await pool.end();
