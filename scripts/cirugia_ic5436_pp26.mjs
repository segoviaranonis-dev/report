#!/usr/bin/env node
/**
 * Cirugía IC PP-26 (PP-2026-0017) desde Excel IC-5436.xlsx
 * Uso:
 *   node scripts/cirugia_ic5436_pp26.mjs --dry-run
 *   node scripts/cirugia_ic5436_pp26.mjs --apply
 */
import fs from "fs";
import pg from "pg";
import XLSX from "xlsx";

const DRY = !process.argv.includes("--apply");
const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "C:/Users/hecto/Downloads/ANDRES-1807/0839-7932-38/IC-5436.xlsx";
const PP_ID = 26;
const PRECIO_EVENTO_ID = 45;

const LP_TO_ID = { LPN: 1, LPC02: 2, LPC03: 3, LPC04: 4 };

const PLAZO_EXCEL_A_DESC = {
  "CR30-60-90": "30-60-90 DÍAS",
  "CR-6090120": "30-60-90-120 DÍAS",
  "CR-30A120D": "30-60-90-120 DÍAS",
  "CR-EFECTIV": "EFECTIVO",
  "CR-60-150": "90-120-150 DÍAS",
  "CR-CONTADO": "EFECTIVO",
  "CR-30": "30 DÍAS",
  "CR-90": "90 DÍAS",
  "CR-150": "150 DIAS",
  "CR-30/60": "30-60-90 DÍAS",
  "CR-60": "60 DÍAS",
  "CR-90A150": "90-120-150 DÍAS",
  "CR-90-150": "90-120-150 DÍAS",
  "CR-20": "20 DÍAS",
};

function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normIcNro(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/IC-2026-(\d+)/i);
  if (!m) return s;
  return `IC-2026-${m[1].padStart(4, "0")}`;
}

function calcularNeto(bruto, d1, d2, d3, d4) {
  let neto = bruto;
  for (const pct of [d1, d2, d3, d4]) {
    if (pct > 0) neto *= 1 - pct / 100;
  }
  return Math.round(neto * 100) / 100;
}

function parseExcelRow(r) {
  const lpCod = norm(String(r["LIST.PREC"] ?? "").replace(/\s+/g, ""));
  const listado_precio_id = LP_TO_ID[lpCod] ?? null;
  const d1 = Number(r["D1"] ?? 0);
  const d2 = Number(r["D2"] ?? 0);
  const d3 = Number(r["D3"] ?? 0);
  const d4 = Number(r["D4"] ?? 0);
  const bruto = Number(r["IMPORTE"] ?? 0);
  const netoExcel = Number(r["IMP.NETO"] ?? 0);
  const netoCalc = calcularNeto(bruto, d1, d2, d3, d4);
  return {
    nro_ic: normIcNro(r["Nº de I-C"] ?? r["N de I-C"]),
    id_cliente: Number(r["COD.CLIENTE"]),
    id_vendedor: Number(r["COD.VEND"]),
    id_marca: Number(r["COD.MARCA"]),
    cantidad_total_pares: Number(String(r["CANT  "] ?? r["CANT"] ?? 0).replace(/\s/g, "")),
    monto_bruto: bruto,
    monto_neto: netoExcel || netoCalc,
    descuento_1: d1,
    descuento_2: d2,
    descuento_3: d3,
    descuento_4: d4,
    listado_precio_id,
    list_prec: lpCod,
    nro_pedido_fabrica: String(r["N° PEDIDO"] ?? r["N PEDIDO"] ?? "").trim(),
    factura: String(r["FACTURA"] ?? "").trim(),
    plazo_excel: norm(String(r["PLAZO"] ?? "")),
    quincena_arribo_id: Number(r["EMBARQUE"] ?? 0) || null,
  };
}

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

try {
  if (!fs.existsSync(EXCEL)) {
    console.error("Excel no encontrado:", EXCEL);
    process.exit(1);
  }

  const { rows: plazosBd } = await pool.query("SELECT id_plazo, descp_plazo FROM plazo_v2");
  const plazoByDesc = Object.fromEntries(
    plazosBd.map((r) => [norm(r.descp_plazo), Number(r.id_plazo)]),
  );
  const plazoFromExcel = {};
  for (const [excel, desc] of Object.entries(PLAZO_EXCEL_A_DESC)) {
    plazoFromExcel[norm(excel)] = plazoByDesc[norm(desc)] ?? null;
  }

  const wb = XLSX.readFile(EXCEL);
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const excelRows = rawRows.map(parseExcelRow).filter((r) => r.nro_ic);
  const excelByNro = new Map(excelRows.map((r) => [r.nro_ic, r]));

  if (excelRows.length !== 98) {
    console.error(`Esperaba 98 filas Excel, hay ${excelRows.length}`);
    process.exit(1);
  }

  for (const r of excelRows) {
    r.id_plazo = plazoFromExcel[r.plazo_excel] ?? null;
    if (!r.id_cliente || !r.id_marca || !r.id_vendedor) {
      console.error("Fila incompleta:", r.nro_ic);
      process.exit(1);
    }
    if (!r.listado_precio_id) {
      console.error("LP inválido:", r.nro_ic, r.list_prec);
      process.exit(1);
    }
    if (!r.id_plazo) {
      console.error("Plazo sin mapa:", r.nro_ic, r.plazo_excel);
      process.exit(1);
    }
    if (!r.nro_pedido_fabrica) {
      console.error("N° pedido vacío:", r.nro_ic);
      process.exit(1);
    }
  }

  const { rows: ppRows } = await pool.query(
    `SELECT id, numero_registro, pares_comprometidos, proveedor_importacion_id, categoria_id, quincena_arribo_id, estado
     FROM pedido_proveedor WHERE id = $1`,
    [PP_ID],
  );
  const pp = ppRows[0];
  if (!pp) {
    console.error("PP no encontrado:", PP_ID);
    process.exit(1);
  }
  if (pp.estado !== "ABIERTO") {
    console.error("PP no editable, estado:", pp.estado);
    process.exit(1);
  }

  const { rows: bdIcs } = await pool.query(
    `SELECT ic.id, ic.numero_registro, ic.id_cliente, ic.id_vendedor, ic.id_marca, ic.id_plazo,
            ic.cantidad_total_pares, ic.monto_bruto, ic.monto_neto,
            ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4,
            ic.listado_precio_id, ic.estado, ic.id_proveedor, ic.tipo_id, ic.categoria_id,
            ic.quincena_arribo_id, ic.fecha_registro, ic.precio_evento_id,
            icp.nro_pedido_fabrica, icp.precio_evento_id AS puente_evento
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = $1`,
    [PP_ID],
  );

  const bdByNro = new Map(bdIcs.map((ic) => [ic.numero_registro, ic]));
  const soloBd = [...bdByNro.keys()].filter((k) => !excelByNro.has(k));
  const soloExcel = [...excelByNro.keys()].filter((k) => !bdByNro.has(k));

  const plan = {
    updates: [],
    bridge_updates: [],
    desasignar: [],
    crear: [],
    eliminar_pool: [],
  };

  for (const [nro, ex] of excelByNro) {
    const bd = bdByNro.get(nro);
    if (!bd) continue;
    const patch = {};
    const fields = [
      ["id_cliente", ex.id_cliente],
      ["id_marca", ex.id_marca],
      ["id_plazo", ex.id_plazo],
      ["cantidad_total_pares", ex.cantidad_total_pares],
      ["monto_bruto", ex.monto_bruto],
      ["monto_neto", ex.monto_neto],
      ["descuento_1", ex.descuento_1],
      ["descuento_2", ex.descuento_2],
      ["descuento_3", ex.descuento_3],
      ["descuento_4", ex.descuento_4],
      ["listado_precio_id", ex.listado_precio_id],
    ];
    for (const [k, v] of fields) {
      const cur = bd[k];
      const curN = typeof cur === "string" && k !== "monto_neto" && k !== "monto_bruto" ? Number(cur) : cur;
      if (k === "monto_bruto" || k === "monto_neto") {
        if (Math.abs(Number(curN) - Number(v)) > 1) patch[k] = v;
      } else if (Number(curN) !== Number(v)) {
        patch[k] = v;
      }
    }
    if (Object.keys(patch).length) plan.updates.push({ nro, id: Number(bd.id), patch });
    if (String(bd.nro_pedido_fabrica ?? "").trim() !== ex.nro_pedido_fabrica) {
      plan.bridge_updates.push({
        nro,
        ic_id: Number(bd.id),
        from: bd.nro_pedido_fabrica,
        to: ex.nro_pedido_fabrica,
      });
    }
  }

  for (const nro of soloBd) {
    const bd = bdByNro.get(nro);
    plan.desasignar.push({
      nro,
      id: Number(bd.id),
      pares: Number(bd.cantidad_total_pares),
    });
    plan.eliminar_pool.push({ nro, id: Number(bd.id) });
  }

  for (const nro of soloExcel) {
    plan.crear.push({ nro, ...excelByNro.get(nro) });
  }

  const excelPares = excelRows.reduce((s, r) => s + r.cantidad_total_pares, 0);
  const bdPares = bdIcs.reduce((s, ic) => s + Number(ic.cantidad_total_pares), 0);
  const deltaPares =
    plan.crear.reduce((s, r) => s + r.cantidad_total_pares, 0) -
    plan.desasignar.reduce((s, r) => s + r.pares, 0) +
    plan.updates.reduce((s, u) => {
      const bd = bdByNro.get(u.nro);
      const oldP = Number(bd.cantidad_total_pares);
      const newP = u.patch.cantidad_total_pares ?? oldP;
      return s + (newP - oldP);
    }, 0);

  const preview = {
    modo: DRY ? "dry-run" : "apply",
    pp_id: PP_ID,
    pp_numero: pp.numero_registro,
    excel_filas: excelRows.length,
    bd_ic_antes: bdIcs.length,
    bd_ic_despues: excelRows.length,
    excel_pares: excelPares,
    bd_pares_antes: bdPares,
    delta_pares_pp: deltaPares,
    pares_comprometidos_nuevo: Number(pp.pares_comprometidos) + deltaPares,
    updates_ic: plan.updates.length,
    bridge_updates: plan.bridge_updates.length,
    desasignar: plan.desasignar.map((x) => x.nro),
    crear: plan.crear.map((x) => x.nro),
    updates_muestra: plan.updates.slice(0, 8),
    bridge_muestra: plan.bridge_updates.slice(0, 5),
  };

  console.log(JSON.stringify(preview, null, 2));

  if (excelPares !== bdPares + deltaPares) {
    console.error("FAIL: pares no cierran después del plan");
    process.exit(1);
  }
  if (preview.pares_comprometidos_nuevo !== excelPares) {
    console.error("FAIL: pares_comprometidos PP no coincide con Excel", preview.pares_comprometidos_nuevo, excelPares);
    process.exit(1);
  }

  if (DRY) {
    console.log("DRY-RUN OK — ejecutar con --apply para aplicar");
    process.exit(0);
  }

  const { rows: tplRows } = await pool.query(
    `SELECT id_proveedor, id_vendedor, tipo_id, categoria_id, quincena_arribo_id, fecha_registro
     FROM intencion_compra WHERE numero_registro = 'IC-2026-0387' LIMIT 1`,
  );
  const tpl = tplRows[0];
  if (!tpl) {
    console.error("Plantilla IC-2026-0387 no encontrada");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const item of plan.desasignar) {
      await client.query(
        `DELETE FROM intencion_compra_pedido WHERE intencion_compra_id = $1 AND pedido_proveedor_id = $2`,
        [item.id, PP_ID],
      );
      await client.query(`UPDATE intencion_compra SET estado = 'AUTORIZADO' WHERE id = $1`, [item.id]);
    }

    for (const item of plan.eliminar_pool) {
      const puente = await client.query(
        `SELECT 1 FROM intencion_compra_pedido WHERE intencion_compra_id = $1`,
        [item.id],
      );
      if (puente.rowCount) throw new Error(`${item.nro} aún tiene puente PP`);
      await client.query(`DELETE FROM intencion_compra WHERE id = $1`, [item.id]);
    }

    for (const u of plan.updates) {
      const sets = [];
      const vals = [];
      let i = 1;
      for (const [k, v] of Object.entries(u.patch)) {
        sets.push(`${k} = $${i++}`);
        vals.push(v);
      }
      sets.push(`precio_evento_id = $${i++}`);
      vals.push(PRECIO_EVENTO_ID);
      sets.push(`estado = 'DIGITADO'`);
      vals.push(u.id);
      await client.query(`UPDATE intencion_compra SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    }

    for (const b of plan.bridge_updates) {
      await client.query(
        `UPDATE intencion_compra_pedido
         SET nro_pedido_fabrica = $3, precio_evento_id = $4
         WHERE intencion_compra_id = $1 AND pedido_proveedor_id = $2`,
        [b.ic_id, PP_ID, b.to, PRECIO_EVENTO_ID],
      );
    }

    for (const c of plan.crear) {
      const vendRes = await client.query(
        `SELECT ic.id_vendedor FROM intencion_compra ic
         JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
         WHERE icp.pedido_proveedor_id = $1 AND ic.id_cliente = $2
         LIMIT 1`,
        [PP_ID, c.id_cliente],
      );
      const id_vendedor = Number(vendRes.rows[0]?.id_vendedor ?? tpl.id_vendedor ?? 8);

      const ins = await client.query(
        `INSERT INTO intencion_compra (
          numero_registro, id_proveedor, id_cliente, id_vendedor, id_marca, id_plazo,
          tipo_id, categoria_id, cantidad_total_pares,
          monto_bruto, descuento_1, descuento_2, descuento_3, descuento_4,
          monto_neto, fecha_registro, quincena_arribo_id,
          estado, precio_evento_id, listado_precio_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          'DIGITADO',$18,$19
        ) RETURNING id`,
        [
          c.nro_ic,
          Number(tpl.id_proveedor),
          c.id_cliente,
          id_vendedor,
          c.id_marca,
          c.id_plazo,
          Number(tpl.tipo_id),
          Number(tpl.categoria_id),
          c.cantidad_total_pares,
          c.monto_bruto,
          c.descuento_1,
          c.descuento_2,
          c.descuento_3,
          c.descuento_4,
          c.monto_neto,
          tpl.fecha_registro,
          c.quincena_arribo_id ?? Number(tpl.quincena_arribo_id),
          PRECIO_EVENTO_ID,
          c.listado_precio_id,
        ],
      );
      const icId = Number(ins.rows[0].id);
      await client.query(
        `INSERT INTO intencion_compra_pedido (
          intencion_compra_id, pedido_proveedor_id, nro_pedido_fabrica, precio_evento_id, asignado_por
        ) VALUES ($1, $2, $3, $4, NULL)`,
        [icId, PP_ID, c.nro_pedido_fabrica, PRECIO_EVENTO_ID],
      );
    }

    await client.query(
      `UPDATE pedido_proveedor SET pares_comprometidos = $2 WHERE id = $1`,
      [PP_ID, excelPares],
    );

    await client.query(
      `UPDATE intencion_compra_pedido SET precio_evento_id = $2
       WHERE pedido_proveedor_id = $1 AND COALESCE(precio_evento_id, 0) <> $2`,
      [PP_ID, PRECIO_EVENTO_ID],
    );

    await client.query("COMMIT");

    const { rows: post } = await pool.query(
      `SELECT COUNT(*)::int n, SUM(ic.cantidad_total_pares)::int pares
       FROM intencion_compra_pedido icp
       JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
       WHERE icp.pedido_proveedor_id = $1`,
      [PP_ID],
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          ic_vinculadas: post[0].n,
          pares: post[0].pares,
          url: `http://localhost:3000/proceso-importacion/pedido-proveedor/${PP_ID}`,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FAIL ROLLBACK:", e);
    process.exit(1);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
