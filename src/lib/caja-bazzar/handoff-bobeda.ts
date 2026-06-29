import { getRimecPool } from "@/lib/rimec/pool";
import { TABLA_BANDEJA, TABLA_BOBINA } from "./pos-tables";

export async function tablaBandejaExiste(): Promise<boolean> {
  const pool = getRimecPool();
  const r = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.${TABLA_BANDEJA}') IS NOT NULL AS reg`,
  );
  return Boolean(r.rows[0]?.reg);
}

export async function tablaBobedaExiste(): Promise<boolean> {
  const pool = getRimecPool();
  const r = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.${TABLA_BOBINA}') IS NOT NULL AS reg`,
  );
  return Boolean(r.rows[0]?.reg);
}

export async function marcarCsvDescargado(
  codigos: string[],
  clienteId: number,
): Promise<{ updated: number }> {
  const pool = getRimecPool();
  const r = await pool.query(
    `
      UPDATE public.${TABLA_BANDEJA}
      SET estado = 'CSV_DESCARGADO', csv_descargado_at = now()
      WHERE codigo_bandeja = ANY($1::text[])
        AND cliente_id = $2
        AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
    `,
    [codigos, clienteId],
  );
  return { updated: r.rowCount ?? 0 };
}

export type EnviarEmpaqueInput = {
  clienteId: number;
  codigos?: string[];
  stagingId?: number | null;
};

type BandejaRow = {
  codigo_bandeja: string;
  cliente_id: number;
  marca: string;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  vendedor_bazzar_id: number | null;
  staging_id: number | null;
  cedula_cliente: string | null;
  clients_bazaar_id: number | null;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number;
  grada: string;
  snapshot_json: Record<string, unknown> | null;
  snapshot_cliente: Record<string, unknown> | null;
  created_at: Date;
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
  precio_unitario: number | null;
};

function precioDesdeBandeja(row: BandejaRow): number | null {
  if (row.precio_unitario != null && Number.isFinite(Number(row.precio_unitario))) {
    return Number(row.precio_unitario);
  }
  const snap = row.snapshot_json?.precio_unitario;
  if (typeof snap === "number" && Number.isFinite(snap) && snap > 0) return snap;
  if (typeof snap === "string" && snap.trim()) {
    const n = Number(snap);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function codigoOroDesdeBandeja(codigoBandeja: string): string {
  if (codigoBandeja.startsWith("ORO-")) return codigoBandeja;
  return `ORO-${codigoBandeja}`;
}

/** Snapshot ORO inmutable — molécula + artículo + titular al momento del handoff. */
function buildSnapshotOro(row: BandejaRow): Record<string, unknown> {
  const snap: Record<string, unknown> =
    row.snapshot_json && typeof row.snapshot_json === "object" ? { ...row.snapshot_json } : {};

  const precio = precioDesdeBandeja(row);
  if (precio != null) snap.precio_unitario = precio;

  snap.linea_id = row.linea_id;
  snap.referencia_id = row.referencia_id;
  snap.material_id = row.material_id;
  snap.color_id = row.color_id;
  snap.grada = row.grada;
  snap.marca = row.marca;
  if (row.numero_fi_fa != null) snap.numero_fi_fa = row.numero_fi_fa;
  if (row.numero_factura_legal?.trim()) snap.numero_factura_legal = row.numero_factura_legal.trim();
  if (row.vendedor_nombre?.trim()) snap.vendedor_nombre = row.vendedor_nombre.trim();
  if (row.vendedor_bazzar_id != null) snap.vendedor_bazzar_id = row.vendedor_bazzar_id;
  if (row.cedula_cliente?.trim()) snap.cedula_cliente = row.cedula_cliente.trim();
  if (row.clients_bazaar_id != null) snap.clients_bazaar_id = row.clients_bazaar_id;
  if (row.snapshot_cliente && typeof row.snapshot_cliente === "object") {
    snap.snapshot_cliente = row.snapshot_cliente;
  }

  return snap;
}

/** Handoff bandeja → Bobeda (Enviar a Empaque). */
export async function enviarBandejaAEmpaque(
  input: EnviarEmpaqueInput,
): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  if (!(await tablaBandejaExiste()) || !(await tablaBobedaExiste())) {
    return { ok: false, error: "Tablas bandeja/bobeda no existen — aplicar migración 005" };
  }

  const pool = getRimecPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let rows;
    if (input.stagingId != null) {
      rows = await client.query<BandejaRow>(
        `
          SELECT codigo_bandeja, cliente_id, marca, vendedor_id, vendedor_nombre, vendedor_bazzar_id,
                 staging_id, cedula_cliente, clients_bazaar_id, linea_id, referencia_id, material_id,
                 color_id, grada, snapshot_json, snapshot_cliente, created_at, numero_fi_fa, numero_factura_legal, precio_unitario
          FROM public.${TABLA_BANDEJA}
          WHERE cliente_id = $1 AND staging_id = $2
            AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
        `,
        [input.clienteId, input.stagingId],
      );
    } else if (input.codigos?.length) {
      rows = await client.query<BandejaRow>(
        `
          SELECT codigo_bandeja, cliente_id, marca, vendedor_id, vendedor_nombre, vendedor_bazzar_id,
                 staging_id, cedula_cliente, clients_bazaar_id, linea_id, referencia_id, material_id,
                 color_id, grada, snapshot_json, snapshot_cliente, created_at, numero_fi_fa, numero_factura_legal, precio_unitario
          FROM public.${TABLA_BANDEJA}
          WHERE cliente_id = $1 AND codigo_bandeja = ANY($2::text[])
            AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
        `,
        [input.clienteId, input.codigos],
      );
    } else {
      await client.query("ROLLBACK");
      return { ok: false, error: "Sin codigos ni staging_id" };
    }

    if (!rows.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Factura no encontrada en bandeja o ya enviada" };
    }

    const codigosBandejaInsertados: string[] = [];
    for (const row of rows.rows) {
      const codigoOro = codigoOroDesdeBandeja(row.codigo_bandeja);
      const precio = precioDesdeBandeja(row);
      const snap = buildSnapshotOro(row);
      const ins = await client.query<{ codigo_oro: string }>(
        `
          INSERT INTO public.${TABLA_BOBINA} (
            codigo_oro, cliente_id, marca, vendedor_id, vendedor_nombre, vendedor_bazzar_id,
            staging_id, bandeja_codigo, cedula_cliente, clients_bazaar_id,
            linea_id, referencia_id, material_id, color_id, grada, cantidad,
            estado, origen, fecha_venta, snapshot_json, created_at,
            numero_fi_fa, numero_factura_legal, precio_unitario
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, 1,
            'PENDIENTE_ENTREGA', 'POS_VIVO', $16::date, $17::jsonb, $18,
            $19, $20, $21
          )
          ON CONFLICT (codigo_oro) DO NOTHING
          RETURNING codigo_oro
        `,
        [
          codigoOro,
          row.cliente_id,
          row.marca,
          row.vendedor_id,
          row.vendedor_nombre,
          row.vendedor_bazzar_id,
          row.staging_id,
          row.codigo_bandeja,
          row.cedula_cliente,
          row.clients_bazaar_id,
          row.linea_id,
          row.referencia_id,
          row.material_id,
          row.color_id,
          row.grada,
          row.created_at.toISOString().slice(0, 10),
          JSON.stringify(snap),
          row.created_at,
          row.numero_fi_fa,
          row.numero_factura_legal,
          precio,
        ],
      );
      if (ins.rowCount) codigosBandejaInsertados.push(row.codigo_bandeja);
    }

    if (!codigosBandejaInsertados.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Bobeda ya contiene esta factura — no se vació bandeja" };
    }

    await client.query(
      `
        DELETE FROM public.${TABLA_BANDEJA}
        WHERE cliente_id = $1 AND codigo_bandeja = ANY($2::text[])
      `,
      [input.clienteId, codigosBandejaInsertados],
    );

    await client.query("COMMIT");
    return { ok: true, inserted: codigosBandejaInsertados.length };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error handoff Bobeda" };
  } finally {
    client.release();
  }
}

export async function marcarEntregadoBobeda(
  codigos: string[],
  clienteId: number,
): Promise<{ updated: number }> {
  const pool = getRimecPool();
  const r = await pool.query(
    `
      UPDATE public.${TABLA_BOBINA}
      SET estado = 'ENTREGADO', entregado_at = now()
      WHERE codigo_oro = ANY($1::text[])
        AND cliente_id = $2
        AND upper(btrim(estado)) = 'PENDIENTE_ENTREGA'
    `,
    [codigos, clienteId],
  );
  return { updated: r.rowCount ?? 0 };
}

/** Compat legacy POST facturar → handoff Empaque */
export async function marcarFacturados(codigos: string[], clienteId: number): Promise<{ updated: number }> {
  const r = await enviarBandejaAEmpaque({ clienteId, codigos });
  if (!r.ok) throw new Error(r.error);
  return { updated: r.inserted };
}
