import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const supaUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();

const pool = new pg.Pool({ connectionString: dbUrl });

const rows = await pool.query(`
SELECT fid.linea_snapshot::text AS snap
FROM factura_interna_detalle fid
JOIN factura_interna fi ON fi.id = fid.factura_id
WHERE fi.pp_id = 15
LIMIT 20
`);

function stem(snap) {
  const o = JSON.parse(snap);
  return `${o.linea_codigo}-${o.ref_codigo}-${o.material_code}-${o.color_code}.jpg`;
}

async function exists(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.status;
  } catch (e) {
    return "ERR";
  }
}

let ok = 0;
let miss = 0;
const samples = [];

for (const r of rows.rows) {
  const file = stem(r.snap);
  const urls = ["sm", "md", "lg"].map((t) => `${supaUrl}/storage/v1/object/public/productos/${t}/${file}`);
  let found = false;
  for (const u of urls) {
    const st = await exists(u);
    if (st === 200) {
      ok++;
      found = true;
      if (samples.length < 3) samples.push({ file, tier: u.split("/productos/")[1], status: st });
      break;
    }
  }
  if (!found) {
    miss++;
    if (samples.length < 6) samples.push({ file, status: "404 all tiers" });
  }
}

console.log({ supaUrl, checked: rows.rowCount, ok, miss, samples });
await pool.end();
