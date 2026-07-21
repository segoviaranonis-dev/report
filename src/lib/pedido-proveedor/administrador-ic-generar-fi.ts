import type { Pool, PoolClient } from "pg";
import {
  calcLineaFiPrecio,
  fiListaTier,
} from "@/lib/pedido-proveedor/aritmetica-programado";
import type { ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import { buildLineaSnapshotForFi } from "@/lib/pedido-proveedor/linea-snapshot-fi";
import { resolveCasoDominanteDesdePpd } from "@/lib/pedido-proveedor/resolve-caso-cabecera-fi";

type SkuFi = {
  ppd_id: number;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number | null;
  lpn: number;
  lpc02: number;
  lpc03: number;
  lpc04: number;
};

type IcCabecera = {
  ic_id: number;
  numero_registro: string;
  id_cliente: number;
  id_vendedor: number | null;
  id_marca: number | null;
  marca_nombre: string | null;
  id_plazo: number | null;
  listado_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

async function getNextNroFiBase(client: PoolClient, ppId: number): Promise<number> {
  const { rows } = await client.query<{ correlativo: number }>(
    `SELECT COALESCE(
       MAX(CAST(REGEXP_REPLACE(nro_factura, '^[0-9]+-PV', '') AS INTEGER)), 0
     ) AS correlativo
     FROM factura_interna
     WHERE pp_id = $1 AND nro_factura ~ '^[0-9]+-PV[0-9]+$'`,
    [ppId],
  );
  return rows[0]?.correlativo ?? 0;
}

function formatNroFi(ppId: number, correlativo: number): string {
  return `${ppId}-PV${String(correlativo).padStart(3, "0")}`;
}

async function loadIcCabecera(pool: Pool, icId: number, ppId: number): Promise<IcCabecera | null> {
  const { rows } = await pool.query<IcCabecera>(
    `SELECT ic.id AS ic_id, ic.numero_registro, ic.id_cliente, ic.id_vendedor, ic.id_plazo,
            ic.id_marca, UPPER(TRIM(mv.descp_marca)) AS marca_nombre,
            ic.listado_precio_id, ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
     FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
     LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
     WHERE ic.id = $1 AND icp.pedido_proveedor_id = $2`,
    [icId, ppId],
  );
  return rows[0] ?? null;
}

async function loadSkusPpd(
  client: PoolClient,
  ppId: number,
  eventoId: number,
  ppdIds: number[],
): Promise<
  Map<
    number,
    SkuFi & {
      linea: string;
      referencia: string;
      descp_material: string;
      descp_color: string;
      material_code: string;
      color_code: string;
      grades_json: unknown;
      cantidad_cajas: number;
      cantidad_pares: number;
    }
  >
> {
  const { rows } = await client.query<
    SkuFi & {
      linea: string;
      referencia: string;
      descp_material: string;
      descp_color: string;
      material_code: string;
      color_code: string;
      grades_json: unknown;
      cantidad_cajas: number;
      cantidad_pares: number;
    }
  >(
    `SELECT ppd.id AS ppd_id, l.id AS linea_id, ref.id AS referencia_id,
            m.id AS material_id, c.id AS color_id,
            COALESCE(pl_fk.lpn, pl_cod.lpn, ppd.precio_lpn, 0)::float AS lpn,
            COALESCE(pl_fk.lpc02, pl_cod.lpc02, ppd.precio_lpc02, 0)::float AS lpc02,
            COALESCE(pl_fk.lpc03, pl_cod.lpc03, ppd.precio_lpc03, 0)::float AS lpc03,
            COALESCE(pl_fk.lpc04, pl_cod.lpc04, ppd.precio_lpc04, 0)::float AS lpc04,
            ppd.linea, ppd.referencia,
            COALESCE(ppd.material_code, '') AS material_code,
            COALESCE(ppd.color_code, '') AS color_code,
            ppd.grades_json,
            COALESCE(ppd.descp_material, '') AS descp_material,
            COALESCE(ppd.descp_color, '') AS descp_color,
            COALESCE(ppd.cantidad_cajas, 1)::int AS cantidad_cajas,
            COALESCE(ppd.cantidad_pares, 0)::int AS cantidad_pares
     FROM pedido_proveedor_detalle ppd
     JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
     LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
     LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
     LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
     LEFT JOIN color c ON c.codigo_proveedor::text = ppd.color_code
     LEFT JOIN precio_lista pl_fk ON pl_fk.evento_id = $3 AND pl_fk.linea_id = l.id
                               AND pl_fk.referencia_id = ref.id AND pl_fk.material_id = m.id
     LEFT JOIN LATERAL (
       SELECT pl.lpn, pl.lpc02, pl.lpc03, pl.lpc04
       FROM precio_lista pl
       WHERE pl.evento_id = $3
         AND TRIM(pl.linea_codigo) = TRIM(ppd.linea)
         AND TRIM(pl.referencia_codigo) = TRIM(ppd.referencia)
         AND (m.id IS NULL OR pl.material_id = m.id)
       ORDER BY CASE WHEN m.id IS NOT NULL AND pl.material_id = m.id THEN 0 ELSE 1 END, pl.id
       LIMIT 1
     ) pl_cod ON TRUE
     WHERE ppd.pedido_proveedor_id = $1 AND ppd.id = ANY($2::int[])`,
    [ppId, ppdIds, eventoId],
  );
  const map = new Map<number, (typeof rows)[0] & { sin_lpn?: boolean }>();
  for (const r of rows) {
    const id = Number(r.ppd_id);
    const hasPrice = r.lpn > 0 || r.lpc02 > 0 || r.lpc03 > 0 || r.lpc04 > 0;
    if (Number.isFinite(id) && id > 0) {
      map.set(id, { ...r, ppd_id: id, sin_lpn: !hasPrice });
    }
  }
  return map;
}

async function resolveEventoIdIc(
  pool: Pool,
  ppId: number,
  icId: number,
): Promise<number | null> {
  const { rows } = await pool.query<{ evento_id: number | null }>(
    `SELECT COALESCE(
       icp.precio_evento_id,
       ic.precio_evento_id,
       (
         SELECT icp2.precio_evento_id
         FROM intencion_compra_pedido icp2
         WHERE icp2.pedido_proveedor_id = $1 AND icp2.precio_evento_id IS NOT NULL
         ORDER BY icp2.id
         LIMIT 1
       )
     )::int AS evento_id
     FROM intencion_compra ic
     JOIN intencion_compra_pedido icp
       ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = $1
     WHERE ic.id = $2`,
    [ppId, icId],
  );
  return rows[0]?.evento_id ?? null;
}

export type GenerarFiAdminResult =
  | {
      ok: true;
      fi_id: number;
      fi_nro: string;
      total_pares: number;
      total_monto: number;
      monto_sin_descuento: number;
      ic_nro: string;
      avisos: string[];
    }
  | { ok: false; error: string; avisos?: string[] };

/** FI real desde pareja Administrador IC — cabecera 100 % IC, detalle PPD seleccionado. */
export async function generarFiDesdeAdministradorIc(
  pool: Pool,
  ppId: number,
  icId: number,
  ppdIds: number[],
  opts?: { listado_tier_preview?: ListadoPrecioTierId; ppd_pares?: Record<number, number> },
): Promise<GenerarFiAdminResult> {
  if (!ppdIds.length) return { ok: false, error: "Seleccioná al menos un artículo PPD." };

  const ic = await loadIcCabecera(pool, icId, ppId);
  if (!ic) return { ok: false, error: "IC no vinculada a este PP." };

  const eventoId = await resolveEventoIdIc(pool, ppId, icId);
  if (!eventoId) return { ok: false, error: "IC sin evento de precios vinculado." };

  const client = await pool.connect();
  const avisos: string[] = [];
  try {
    const skuMap = await loadSkusPpd(client, ppId, eventoId, ppdIds);
    const tier = fiListaTier(ic.listado_precio_id ?? opts?.listado_tier_preview ?? 1);
    const d1 = Number(ic.descuento_1 ?? 0);
    const d2 = Number(ic.descuento_2 ?? 0);
    const d3 = Number(ic.descuento_3 ?? 0);
    const d4 = Number(ic.descuento_4 ?? 0);

    type LineItem = {
      ppd_id: number;
      cajas: number;
      pares: number;
      precio_unit: number;
      precio_neto: number;
      subtotal: number;
      linea_codigo: string;
      ref_codigo: string;
      material_code: string;
      color_code: string;
      material_nombre: string;
      color_nombre: string;
      grades_json: unknown;
      sin_lpn: boolean;
    };

    const items: LineItem[] = [];
    let montoSinDesc = 0;
    let lineasSinLpn = 0;

    for (const ppdId of ppdIds) {
      const row = skuMap.get(Number(ppdId));
      if (!row) {
        avisos.push(`PPD ${ppdId}: no encontrado en stock PP.`);
        continue;
      }
      const sinLpn = Boolean((row as { sin_lpn?: boolean }).sin_lpn);
      const pares = opts?.ppd_pares?.[Number(ppdId)] ?? row.cantidad_pares;
      if (sinLpn) lineasSinLpn += 1;

      let precio_unit = 0;
      let precio_neto = 0;
      let subtotal = 0;
      if (!sinLpn) {
        const calc = calcLineaFiPrecio(row, tier, d1, d2, d3, d4, pares);
        precio_unit = calc.precio_unit;
        precio_neto = calc.precio_neto;
        subtotal = calc.subtotal;
        montoSinDesc += Math.round(precio_unit * pares);
      } else {
        avisos.push(`PPD ${ppdId}: sin LPN — línea en FI con precio 0 (revisar listado).`);
      }

      items.push({
        ppd_id: ppdId,
        cajas: row.cantidad_cajas || 1,
        pares,
        precio_unit,
        precio_neto,
        subtotal,
        linea_codigo: row.linea,
        ref_codigo: row.referencia,
        material_code: row.material_code,
        color_code: row.color_code,
        material_nombre: row.descp_material,
        color_nombre: row.descp_color,
        grades_json: row.grades_json,
        sin_lpn: sinLpn,
      });
    }

    if (!items.length) {
      return {
        ok: false,
        error: `Ninguna línea con precio válido (${ppdIds.length} PPD · revisá listado o snapshot PPD).`,
        avisos,
      };
    }

    await client.query("BEGIN");
    const nro = formatNroFi(ppId, (await getNextNroFiBase(client, ppId)) + 1);
    const totalPares = items.reduce((s, i) => s + i.pares, 0);
    const totalMonto = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
    const casoCab = await resolveCasoDominanteDesdePpd(
      client,
      ppId,
      eventoId,
      items.map((i) => i.ppd_id),
    );
    if (!casoCab.caso) {
      avisos.push("FI sin caso comercial resoluble desde listado/evento — cabecera queda vacía.");
    }

    const fiRes = await client.query<{ id: number }>(
      `INSERT INTO factura_interna
         (pp_id, nro_factura, cliente_id, vendedor_id, plazo_id, lista_precio_id,
          marca, marca_id, caso, caso_id,
          descuento_1, descuento_2, descuento_3, descuento_4, total_pares, total_monto, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'RESERVADA', $17)
       RETURNING id`,
      [
        ppId,
        nro,
        ic.id_cliente,
        ic.id_vendedor,
        ic.id_plazo,
        ic.listado_precio_id ?? 1,
        ic.marca_nombre,
        ic.id_marca,
        casoCab.caso,
        casoCab.caso_id,
        d1,
        d2,
        d3,
        d4,
        totalPares,
        totalMonto,
        ic.numero_registro,
      ],
    );
    const fiId = fiRes.rows[0].id;

    const values: unknown[] = [];
    const tuples = items.map((item, idx) => {
      const base = idx * 8;
      const snap = buildLineaSnapshotForFi({
        linea_codigo: item.linea_codigo,
        ref_codigo: item.ref_codigo,
        material_code: item.material_code,
        color_code: item.color_code,
        material_nombre: item.material_nombre,
        color_nombre: item.color_nombre,
        grades_json: item.grades_json,
        ic_id: ic.ic_id,
        origen: "administrador-ic",
        sin_lpn: item.sin_lpn,
      });
      values.push(
        fiId,
        item.ppd_id,
        item.cajas,
        item.pares,
        item.precio_unit,
        item.subtotal,
        item.precio_neto,
        snap,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}::jsonb)`;
    });
    await client.query(
      `INSERT INTO factura_interna_detalle
         (factura_id, ppd_id, cajas, pares, precio_unit, subtotal, precio_neto, linea_snapshot)
       VALUES ${tuples.join(", ")}`,
      values,
    );

    for (const item of items) {
      if (item.ppd_id && item.pares > 0) {
        await client.query("SELECT descontar_stock_pp($1, $2)", [item.ppd_id, item.pares]);
      }
    }

    await client.query("COMMIT");

    return {
      ok: true,
      fi_id: fiId,
      fi_nro: nro,
      total_pares: totalPares,
      total_monto: totalMonto,
      monto_sin_descuento: montoSinDesc,
      ic_nro: ic.numero_registro,
      avisos,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al generar FI" };
  } finally {
    client.release();
  }
}
