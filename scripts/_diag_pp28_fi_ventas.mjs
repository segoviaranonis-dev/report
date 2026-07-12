import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: dbUrl });

async function main() {
  const pp = await pool.query(
    `SELECT id, numero_registro, numero_proforma FROM pedido_proveedor WHERE numero_registro = 'PP-2026-0019' LIMIT 1`,
  );
  if (!pp.rows[0]) {
    console.log("PP no encontrado");
    process.exit(1);
  }
  const ppId = pp.rows[0].id;
  const fi = await pool.query(
    `SELECT estado, COUNT(*)::int AS n FROM factura_interna WHERE pp_id = $1 GROUP BY estado ORDER BY estado`,
    [ppId],
  );
  const det = await pool.query(
    `SELECT COUNT(DISTINCT fi.id)::int AS fi,
            COUNT(fid.id)::int AS lineas,
            COALESCE(SUM(fid.pares), 0)::int AS pares
     FROM factura_interna fi
     JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
     WHERE fi.pp_id = $1 AND fi.estado IN ('RESERVADA', 'CONFIRMADA')`,
    [ppId],
  );
  const mol = await pool.query(
    `SELECT COUNT(DISTINCT CONCAT(ppd.linea,'-',ppd.referencia,'-',ppd.material_code,'-',ppd.color_code))::int AS moleculas
     FROM factura_interna fi
     JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
     JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
     WHERE fi.pp_id = $1 AND fi.estado IN ('RESERVADA', 'CONFIRMADA')`,
    [ppId],
  );
  console.log(
    JSON.stringify(
      { pp: pp.rows[0], fi_por_estado: fi.rows, detalle: det.rows[0], moleculas_fi: mol.rows[0] },
      null,
      2,
    ),
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
