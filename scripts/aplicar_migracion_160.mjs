import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const envPath = resolve(root, ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

try {
  const sql = readFileSync(
    resolve(root, "migrations/160_descuentos_fi_transaccional.sql"),
    "utf8",
  );
  await pool.query(sql);
  console.log("OK MIG-160 aplicada/reaplicada");

  const r = await pool.query(`
    SELECT public.fn_precio_neto_cascada_gs(100000, 10, 5, 0, 0) AS neto
  `);
  console.log("smoke neto 100000 d10+d5:", r.rows[0]);
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
