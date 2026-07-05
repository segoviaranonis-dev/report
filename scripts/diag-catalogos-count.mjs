import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const { loadIcCatalogos } = await import("../src/lib/intencion-compra/catalogos-query.ts");

const c = await loadIcCatalogos(pool);
console.log("catalogos.marcas:", c.marcas.length);
console.log("catalogos.marcasPorTipo[1]:", c.marcasPorTipo[1]?.length ?? 0);
console.log("sample:", c.marcasPorTipo[1]?.slice(0, 3));
console.log("resolve test:", c.marcasPorTipo[1]?.length ? "OK" : "FAIL");

await pool.end();
