import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { listPpAbiertoProductos } from "../src/lib/herramienta-reposicion/queries-pp-abierto.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  const { productos } = await listPpAbiertoProductos(pool);
  console.log("pp_abierto_productos", productos.length, "pares", productos.reduce((s, p) => s + p.cantidad, 0));
} finally {
  await pool.end();
}
