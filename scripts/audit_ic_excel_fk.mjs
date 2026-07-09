import fs from "fs";
import pg from "pg";
import XLSX from "xlsx";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const EXCEL = process.argv[2] || "C:/Users/hecto/Downloads/PARA INTENCION DE COMPRA.xlsx";
const pool = new pg.Pool({ connectionString: url });

const wb = XLSX.readFile(EXCEL);
const rows = XLSX.utils
  .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" })
  .slice(2)
  .filter((r) => r[3] !== "" && r[3] != null);

const clientes = new Set(rows.map((r) => Number(r[3])));
const marcasText = new Set(rows.map((r) => String(r[2]).trim()));
const vendText = new Set(rows.map((r) => String(r[4]).trim().toUpperCase()));
const plazos = new Set(rows.map((r) => String(r[5]).trim()));
const codVend = new Set(rows.map((r) => Number(r[16])).filter((n) => n > 0));
const codMarca = new Set(rows.map((r) => Number(r[17])).filter((n) => n > 0));
const embarques = new Set(rows.map((r) => String(r[7]).trim()));

const EMBARQUE_MAP = {
  "2DA SETIEMBRE": 18,
  "1RA SETIEMBRE": 17,
  "2DA AGOSTO": 16,
};

try {
  const cOk = await pool.query("SELECT id_cliente FROM cliente_v2 WHERE id_cliente = ANY($1::int[])", [
    [...clientes],
  ]);
  const mOk = await pool.query("SELECT id_marca, descp_marca FROM marca_v2");
  const vOk = await pool.query("SELECT id_vendedor, descp_vendedor FROM vendedor_v2");
  const pOk = await pool.query("SELECT id_plazo, descp_plazo FROM plazo_v2");
  const provOk = await pool.query("SELECT id, nombre FROM proveedor_importacion ORDER BY nombre");

  const missC = [...clientes].filter((id) => !cOk.rows.some((r) => Number(r.id_cliente) === id));
  const marcaMap = Object.fromEntries(
    mOk.rows.map((r) => [String(r.descp_marca).trim().toUpperCase(), Number(r.id_marca)]),
  );
  const missM = [...marcasText].filter((t) => !marcaMap[t.toUpperCase()]);
  const vendMap = {};
  for (const r of vOk.rows) {
    const full = String(r.descp_vendedor).trim().toUpperCase();
    vendMap[full] = Number(r.id_vendedor);
    const first = full.split(/\s+/)[0];
    if (!vendMap[first]) vendMap[first] = Number(r.id_vendedor);
  }
  const missV = [...vendText].filter((t) => !vendMap[t]);
  const plazoMap = {};
  for (const r of pOk.rows) {
    plazoMap[String(r.descp_plazo).trim().toUpperCase()] = Number(r.id_plazo);
  }
  const missP = [...plazos].filter((t) => !plazoMap[t.toUpperCase()]);
  const missCV = [...codVend].filter((id) => !vOk.rows.some((r) => Number(r.id_vendedor) === id));
  const missCM = [...codMarca].filter((id) => !mOk.rows.some((r) => Number(r.id_marca) === id));
  const missE = [...embarques].filter((t) => !EMBARQUE_MAP[t.toUpperCase()]);

  console.log(JSON.stringify({
    filas: rows.length,
    clientes: { total: clientes.size, ok: cOk.rowCount, miss: missC.length, missSample: missC.slice(0, 8) },
    marcasTexto: { miss: missM.length, missList: missM },
    codMarca: { total: codMarca.size, miss: missCM.length, missList: missCM },
    vendedorTexto: { miss: missV.length, missList: missV },
    codVend: { total: codVend.size, miss: missCV.length, missSample: missCV.slice(0, 8) },
    plazo: { miss: missP.length, missList: missP },
    embarque: { values: [...embarques], miss: missE },
    proveedores: provOk.rows.map((r) => ({ id: r.id, nombre: r.nombre })),
    plazosBdSample: pOk.rows.slice(0, 15).map((r) => r.descp_plazo),
  }, null, 2));

  const ev = await pool.query(
    "SELECT id, nombre_evento, estado FROM precio_evento WHERE estado = 'cerrado' ORDER BY id DESC LIMIT 8",
  );
  console.log("eventos_cerrados:", ev.rows);

  const ids = [42, 55, 54, 75, 82];
  const vById = await pool.query("SELECT id_vendedor, descp_vendedor FROM vendedor_v2 WHERE id_vendedor = ANY($1::int[])", [ids]);
  console.log("vendedor_v2_by_cod:", vById.rows);
  const uById = await pool.query("SELECT id_usuario, login, categoria FROM usuario_v2 WHERE id_usuario = ANY($1::int[])", [ids]);
  console.log("usuario_v2_by_cod:", uById.rows);
  const tipos = await pool.query("SELECT id_tipo, descp_tipo FROM tipo_v2 ORDER BY id_tipo");
  console.log("tipos:", tipos.rows);
  const icProg = await pool.query("SELECT COUNT(*)::int AS n FROM intencion_compra WHERE categoria_id = 3");
  console.log("ic_programado_existentes:", icProg.rows[0].n);
} finally {
  await pool.end();
}
