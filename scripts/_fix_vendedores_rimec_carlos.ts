/**
 * Repara id_vendedor en logistica_rimec_pendiente:
 * col F (codigo_vendedor_carlos) → matriz Carlos → id Nexus vendedor_v2.
 * Nunca usa usuario_v2.
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { resolveVendedorDesdeCodigoCarlos } from "../src/lib/logistica-rimec/vendedor-carlos";

async function main() {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("no DATABASE_URL");
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const allV = await client.query<{ id_vendedor: number; descp_vendedor: string }>(
    `SELECT id_vendedor, descp_vendedor FROM vendedor_v2 ORDER BY 1`,
  );
  console.log("vendedor_v2 count", allV.rows.length);
  for (const r of allV.rows) {
    console.log(`  ${r.id_vendedor}: ${r.descp_vendedor}`);
  }

  const pending = await client.query<{
    codigo_vendedor_carlos: number;
    id_vendedor: number | null;
    n: number;
  }>(
    `SELECT codigo_vendedor_carlos, id_vendedor, COUNT(*)::int AS n
     FROM logistica_rimec_pendiente
     GROUP BY 1, 2
     ORDER BY 1`,
  );

  console.log("\n--- mapeo / repair ---");
  let updated = 0;
  for (const row of pending.rows) {
    const code = Number(row.codigo_vendedor_carlos);
    const resolved = resolveVendedorDesdeCodigoCarlos(code);
    console.log(
      `Carlos ${code} x${row.n} | id_bd=${row.id_vendedor} → nexus=${resolved.idNexus} (${resolved.nombreCanon})`,
    );
    if (resolved.idNexus != null && resolved.idNexus !== row.id_vendedor) {
      const u = await client.query(
        `UPDATE logistica_rimec_pendiente
         SET id_vendedor = $1, updated_at = now()
         WHERE codigo_vendedor_carlos = $2`,
        [resolved.idNexus, code],
      );
      updated += u.rowCount ?? 0;
    } else if (resolved.idNexus == null && row.id_vendedor != null) {
      // Código Carlos no está en matriz: limpiar id falso (colisión usuario/vendedor)
      const u = await client.query(
        `UPDATE logistica_rimec_pendiente
         SET id_vendedor = NULL, updated_at = now()
         WHERE codigo_vendedor_carlos = $1
           AND id_vendedor IS NOT NULL`,
        [code],
      );
      updated += u.rowCount ?? 0;
      console.log(`  CLEARED bad id for Carlos ${code}`);
    }
  }

  console.log("\nrows updated", updated);

  const after = await client.query(
    `SELECT l.codigo_vendedor_carlos, l.id_vendedor, vd.descp_vendedor, COUNT(*)::int n
     FROM logistica_rimec_pendiente l
     LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
     GROUP BY 1,2,3
     ORDER BY 1`,
  );
  console.log("\n--- after ---");
  for (const r of after.rows) console.log(r);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
