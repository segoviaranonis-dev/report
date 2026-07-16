/**
 * Hidrata traspaso_detalle desde snapshot_json cuando resolveCombinacion falló al crear TRP.
 */
import type { PoolClient } from "pg";
import { resolveCombinacionId } from "@/lib/rimec-abastecimiento/traspaso-mutations";

type SnapshotItem = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  tallas: Record<string, number>;
};

function parseSnapshot(raw: unknown): { items: SnapshotItem[] } {
  let obj: Record<string, unknown> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) obj = raw as Record<string, unknown>;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      try {
        obj = JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>;
      } catch {
        return { items: [] };
      }
    }
  }
  const items = Array.isArray(obj.items) ? obj.items : [];
  const out: SnapshotItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const tallas = rec.tallas;
    if (!tallas || typeof tallas !== "object") continue;
    out.push({
      linea: String(rec.linea ?? ""),
      referencia: String(rec.referencia ?? ""),
      material: String(rec.material ?? ""),
      color: String(rec.color ?? ""),
      tallas: tallas as Record<string, number>,
    });
  }
  return { items: out };
}

/** Inserta líneas faltantes en traspaso_detalle desde snapshot. */
export async function hydrateTraspasoDetalleFromSnapshot(
  client: PoolClient,
  traspasoId: number,
): Promise<{ inserted: number; pares: number }> {
  const trp = await client.query<{ snapshot_json: unknown }>(
    `SELECT snapshot_json FROM traspaso WHERE id = $1`,
    [traspasoId],
  );
  const { items } = parseSnapshot(trp.rows[0]?.snapshot_json);
  if (!items.length) return { inserted: 0, pares: 0 };

  let inserted = 0;
  let pares = 0;

  for (const rec of items) {
    for (const [col, qtyVal] of Object.entries(rec.tallas ?? {})) {
      const qty = Math.trunc(Number(qtyVal) || 0);
      if (qty <= 0) continue;
      const talla = col.replace(/^t/i, "");
      const combId = await resolveCombinacionId(
        client,
        rec.linea,
        rec.referencia,
        rec.material,
        rec.color,
        talla,
      );
      if (!combId) continue;

      const exists = await client.query<{ id: number }>(
        `
        SELECT id FROM traspaso_detalle
        WHERE traspaso_id = $1 AND combinacion_id = $2
        LIMIT 1
        `,
        [traspasoId, combId],
      );
      if (exists.rows.length) continue;

      await client.query(
        `INSERT INTO traspaso_detalle (traspaso_id, combinacion_id, cantidad) VALUES ($1, $2, $3)`,
        [traspasoId, combId, qty],
      );
      inserted += 1;
      pares += qty;
    }
  }

  return { inserted, pares };
}

/** Repara ingreso vacío en TRP ya CONFIRMADO — completa detalle + movimiento_detalle. */
export async function repararIngresoTraspasoConfirmado(
  client: PoolClient,
  traspasoId: number,
): Promise<{ ok: true; detalle: number; pares: number; movLines: number } | { ok: false; error: string }> {
  const lock = await client.query<{ estado: string; numero_registro: string }>(
    `SELECT estado, numero_registro FROM traspaso WHERE id = $1 FOR UPDATE`,
    [traspasoId],
  );
  if (!lock.rows.length) return { ok: false, error: "Traspaso no encontrado." };

  const { estado, numero_registro: trpNum } = lock.rows[0];
  if (estado !== "CONFIRMADO") {
    return { ok: false, error: `Estado ${estado} — solo repara CONFIRMADO.` };
  }

  const { inserted, pares } = await hydrateTraspasoDetalleFromSnapshot(client, traspasoId);
  if (inserted === 0 && pares === 0) {
    const cnt = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM traspaso_detalle WHERE traspaso_id = $1`,
      [traspasoId],
    );
    if (parseInt(cnt.rows[0]?.n ?? "0", 10) === 0) {
      return { ok: false, error: "Sin líneas resolubles en snapshot (combinación)." };
    }
  }

  let movRes = await client.query<{ id: number }>(
    `
    SELECT id FROM movimiento
    WHERE documento_ref = $1 AND tipo = 'INGRESO_COMPRA'
    ORDER BY id DESC
    LIMIT 1
    `,
    [trpNum],
  );
  let movId = movRes.rows[0]?.id;
  if (!movId) {
    const ins = await client.query<{ id: number }>(
      `
      INSERT INTO movimiento (tipo, fecha, almacen_origen_id, almacen_destino_id, documento_ref, estado)
      VALUES ('INGRESO_COMPRA', CURRENT_DATE, 3, 1, $1, 'CONFIRMADO')
      RETURNING id
      `,
      [trpNum],
    );
    movId = ins.rows[0]?.id;
  }
  if (!movId) return { ok: false, error: "No se pudo obtener movimiento de ingreso." };

  const lines = await client.query<{ combinacion_id: number; cantidad: number }>(
    `SELECT combinacion_id, cantidad FROM traspaso_detalle WHERE traspaso_id = $1`,
    [traspasoId],
  );

  let movLines = 0;
  for (const line of lines.rows) {
    const dup = await client.query<{ id: number }>(
      `
      SELECT id FROM movimiento_detalle
      WHERE movimiento_id = $1 AND combinacion_id = $2
      LIMIT 1
      `,
      [movId, line.combinacion_id],
    );
    if (dup.rows.length) continue;
    await client.query(
      `INSERT INTO movimiento_detalle (movimiento_id, combinacion_id, cantidad, signo) VALUES ($1, $2, $3, 1)`,
      [movId, line.combinacion_id, Math.trunc(Number(line.cantidad) || 0)],
    );
    movLines += 1;
  }

  return { ok: true, detalle: inserted, pares, movLines };
}
