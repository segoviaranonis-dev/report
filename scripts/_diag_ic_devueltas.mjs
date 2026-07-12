import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const cols = await c.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'intencion_compra' AND column_name IN ('motivo_devolucion', 'devuelto_at')`,
);
console.log("columnas:", cols.rows);

const ic = await c.query(
  `SELECT id, numero_registro, estado, motivo_devolucion, devuelto_at
   FROM intencion_compra WHERE numero_registro = 'IC-2026-0244' OR id = 244`,
);
console.log("IC 244:", ic.rows);

const n = await c.query(
  `SELECT COUNT(*)::int AS c FROM intencion_compra WHERE estado = 'DEVUELTO_ADMIN'`,
);
console.log("total DEVUELTO_ADMIN:", n.rows[0]);

await c.end();
