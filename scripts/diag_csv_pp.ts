import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

import { getRimecPool } from "../src/lib/rimec/pool";

const ppId = Number(process.argv[2] ?? 26);

async function main() {
  const pool = getRimecPool();
  const base = await pool.query<{
    n_ic: number;
    n_fi: number;
    n_clientes_fi: number;
    n_bloques_csv: number;
  }>(
    `SELECT
      (SELECT COUNT(*)::int FROM intencion_compra_pedido WHERE pedido_proveedor_id = $1) AS n_ic,
      (SELECT COUNT(*)::int FROM factura_interna WHERE pp_id = $1) AS n_fi,
      (SELECT COUNT(DISTINCT cliente_id)::int FROM factura_interna WHERE pp_id = $1) AS n_clientes_fi,
      (SELECT COUNT(*)::int FROM (
         SELECT DISTINCT cliente_id, COALESCE(plazo_id, 0) FROM factura_interna WHERE pp_id = $1
       ) t) AS n_bloques_csv`,
    [ppId],
  );
  console.log("pp", ppId, base.rows[0]);

  const marcasPorFi = await pool.query<{ fi_id: number; n_marcas: number; marcas: string }>(
    `SELECT fi.id AS fi_id, COUNT(DISTINCT ppd.id_marca)::int AS n_marcas,
            STRING_AGG(DISTINCT mv.descp_marca, ' / ' ORDER BY mv.descp_marca) AS marcas
     FROM factura_interna fi
     JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
     JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
     JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
     WHERE fi.pp_id = $1
     GROUP BY fi.id
     HAVING COUNT(DISTINCT ppd.id_marca) > 1
     ORDER BY fi.id
     LIMIT 10`,
    [ppId],
  );
  console.log("fi_con_2+_marcas", marcasPorFi.rowCount, marcasPorFi.rows.slice(0, 5));

  const icPorCliente = await pool.query<{ id_cliente: number; n_ic: number }>(
    `SELECT ic.id_cliente, COUNT(*)::int AS n_ic
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = $1
     GROUP BY ic.id_cliente
     HAVING COUNT(*) > 1
     ORDER BY n_ic DESC
     LIMIT 5`,
    [ppId],
  );
  console.log("clientes_con_varias_ic", icPorCliente.rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
