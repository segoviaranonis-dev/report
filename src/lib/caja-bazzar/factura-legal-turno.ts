import { getRimecPool } from "@/lib/rimec/pool";
import { isCajaClienteId } from "./tiendas";
import { TABLA_BANDEJA } from "./pos-tables";

export const TABLA_FACTURA_LEGAL_TURNO = "caja_factura_legal_turno";
const MAX_HISTORIAL = 50;
const SERIAL_MAX_LEN = 64;

export type FacturaLegalTurno = {
  cliente_id: number;
  serial_activo: string;
  prefijo: string;
  contador: number;
  puede_anterior: boolean;
  historial_len: number;
};

export function validarSerialAlfanumerico(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s || s.length > SERIAL_MAX_LEN) return null;
  if (!/^[A-Z0-9][A-Z0-9._\-/]*$/.test(s)) return null;
  return s;
}

/** Incrementa sufijo numérico final; preparado para serial alfanumérico externo. */
export function incrementarSerialAlfanumerico(serial: string): string {
  const s = serial.trim();
  const m = s.match(/^(.*?)(\d+)$/);
  if (m) {
    const width = m[2].length;
    const next = (BigInt(m[2]) + BigInt(1)).toString();
    const padded = next.padStart(width, "0");
    return `${m[1]}${padded}`.slice(0, SERIAL_MAX_LEN);
  }
  return `${s}-1`.slice(0, SERIAL_MAX_LEN);
}

function serialInicial(clienteId: number): string {
  return `PEND-${clienteId}-000001`;
}

async function tablaExiste(): Promise<boolean> {
  const pool = getRimecPool();
  const r = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.${TABLA_FACTURA_LEGAL_TURNO}') IS NOT NULL AS reg`,
  );
  return Boolean(r.rows[0]?.reg);
}

type RowTurno = {
  cliente_id: number;
  serial_activo: string;
  prefijo: string;
  contador: string;
  historial: unknown;
};

function mapTurno(row: RowTurno): FacturaLegalTurno {
  const historial = Array.isArray(row.historial) ? row.historial : [];
  return {
    cliente_id: row.cliente_id,
    serial_activo: row.serial_activo?.trim() || serialInicial(row.cliente_id),
    prefijo: row.prefijo?.trim() || "",
    contador: Number(row.contador) || 0,
    puede_anterior: historial.length > 0,
    historial_len: historial.length,
  };
}

async function ensureRow(clienteId: number): Promise<void> {
  const pool = getRimecPool();
  await pool.query(
    `
      INSERT INTO public.${TABLA_FACTURA_LEGAL_TURNO} (cliente_id, serial_activo, prefijo, contador)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (cliente_id) DO NOTHING
    `,
    [clienteId, serialInicial(clienteId), `PEND-${clienteId}-`],
  );
}

export async function obtenerFacturaLegalTurno(clienteId: number): Promise<FacturaLegalTurno | null> {
  if (!isCajaClienteId(clienteId) || !(await tablaExiste())) return null;
  await ensureRow(clienteId);
  const pool = getRimecPool();
  const r = await pool.query<RowTurno>(
    `SELECT cliente_id, serial_activo, prefijo, contador::text, historial
     FROM public.${TABLA_FACTURA_LEGAL_TURNO} WHERE cliente_id = $1`,
    [clienteId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return mapTurno(row);
}

export async function avanzarSiguienteFacturaLegal(
  clienteId: number,
  operador?: string | null,
): Promise<{ ok: true; turno: FacturaLegalTurno } | { ok: false; error: string }> {
  if (!isCajaClienteId(clienteId) || !(await tablaExiste())) {
    return { ok: false, error: "Tabla factura legal no disponible — migración 011" };
  }
  await ensureRow(clienteId);
  const pool = getRimecPool();
  const cur = await pool.query<RowTurno>(
    `SELECT cliente_id, serial_activo, prefijo, contador::text, historial
     FROM public.${TABLA_FACTURA_LEGAL_TURNO} WHERE cliente_id = $1 FOR UPDATE`,
    [clienteId],
  );
  const row = cur.rows[0];
  if (!row) return { ok: false, error: "Turno no encontrado" };

  const actual = row.serial_activo?.trim() || serialInicial(clienteId);
  const historial = Array.isArray(row.historial) ? [...(row.historial as string[])] : [];
  historial.push(actual);
  if (historial.length > MAX_HISTORIAL) historial.shift();

  const siguiente = incrementarSerialAlfanumerico(actual);
  const contador = Number(row.contador) + 1;

  await pool.query(
    `
      UPDATE public.${TABLA_FACTURA_LEGAL_TURNO}
      SET serial_activo = $2, contador = $3, historial = $4::jsonb,
          updated_at = now(), updated_by = $5
      WHERE cliente_id = $1
    `,
    [clienteId, siguiente, contador, JSON.stringify(historial), operador?.trim() || null],
  );

  const turno = await obtenerFacturaLegalTurno(clienteId);
  if (!turno) return { ok: false, error: "Error al leer turno" };
  return { ok: true, turno };
}

export async function retrocederAnteriorFacturaLegal(
  clienteId: number,
  operador?: string | null,
): Promise<{ ok: true; turno: FacturaLegalTurno } | { ok: false; error: string }> {
  if (!isCajaClienteId(clienteId) || !(await tablaExiste())) {
    return { ok: false, error: "Tabla factura legal no disponible" };
  }
  const pool = getRimecPool();
  const cur = await pool.query<RowTurno>(
    `SELECT cliente_id, serial_activo, prefijo, contador::text, historial
     FROM public.${TABLA_FACTURA_LEGAL_TURNO} WHERE cliente_id = $1 FOR UPDATE`,
    [clienteId],
  );
  const row = cur.rows[0];
  if (!row) return { ok: false, error: "Turno no encontrado" };

  const historial = Array.isArray(row.historial) ? [...(row.historial as string[])] : [];
  if (!historial.length) return { ok: false, error: "No hay serial anterior en este turno" };

  const anterior = historial.pop()!;
  await pool.query(
    `
      UPDATE public.${TABLA_FACTURA_LEGAL_TURNO}
      SET serial_activo = $2, historial = $3::jsonb, updated_at = now(), updated_by = $4
      WHERE cliente_id = $1
    `,
    [clienteId, anterior, JSON.stringify(historial), operador?.trim() || null],
  );

  const turno = await obtenerFacturaLegalTurno(clienteId);
  if (!turno) return { ok: false, error: "Error al leer turno" };
  return { ok: true, turno };
}

export async function fijarSerialActivoFacturaLegal(
  clienteId: number,
  serial: string,
  operador?: string | null,
): Promise<{ ok: true; turno: FacturaLegalTurno } | { ok: false; error: string }> {
  const valid = validarSerialAlfanumerico(serial);
  if (!valid) return { ok: false, error: "Serial inválido (alfanumérico · máx 64)" };
  if (!(await tablaExiste())) return { ok: false, error: "Tabla factura legal no disponible" };
  await ensureRow(clienteId);
  const pool = getRimecPool();
  await pool.query(
    `
      UPDATE public.${TABLA_FACTURA_LEGAL_TURNO}
      SET serial_activo = $2, updated_at = now(), updated_by = $3
      WHERE cliente_id = $1
    `,
    [clienteId, valid, operador?.trim() || null],
  );
  const turno = await obtenerFacturaLegalTurno(clienteId);
  if (!turno) return { ok: false, error: "Error al leer turno" };
  return { ok: true, turno };
}

export async function asignarSerialActivoAFacturaBandeja(input: {
  clienteId: number;
  stagingId?: number | null;
  codigos?: string[];
  serial?: string | null;
}): Promise<{ ok: true; updated: number; serial: string } | { ok: false; error: string }> {
  let serial = input.serial?.trim() ? validarSerialAlfanumerico(input.serial) : null;
  if (!serial) {
    const turno = await obtenerFacturaLegalTurno(input.clienteId);
    if (!turno?.serial_activo) return { ok: false, error: "Sin serial activo en turno" };
    serial = turno.serial_activo;
  }

  const pool = getRimecPool();
  let r;
  if (input.stagingId != null) {
    r = await pool.query(
      `
        UPDATE public.${TABLA_BANDEJA}
        SET numero_factura_legal = $1::text,
            snapshot_json = COALESCE(snapshot_json, '{}'::jsonb)
              || jsonb_build_object('numero_factura_legal', $1::text)
        WHERE cliente_id = $2 AND staging_id = $3
          AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
      `,
      [serial, input.clienteId, input.stagingId],
    );
  } else if (input.codigos?.length) {
    r = await pool.query(
      `
        UPDATE public.${TABLA_BANDEJA}
        SET numero_factura_legal = $1::text,
            snapshot_json = COALESCE(snapshot_json, '{}'::jsonb)
              || jsonb_build_object('numero_factura_legal', $1::text)
        WHERE cliente_id = $2 AND codigo_bandeja = ANY($3::text[])
          AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
      `,
      [serial, input.clienteId, input.codigos],
    );
  } else {
    return { ok: false, error: "Sin staging_id ni codigos" };
  }

  const updated = r.rowCount ?? 0;
  if (!updated) return { ok: false, error: "Factura no encontrada en bandeja" };
  return { ok: true, updated, serial };
}

/** Antes del handoff: asegura numero_factura_legal en filas bandeja (vital bóveda). */
export async function asegurarSerialLegalEnBandeja(input: {
  clienteId: number;
  stagingId?: number | null;
  codigos?: string[];
}): Promise<{ serial: string; stamped: number }> {
  const turno = await obtenerFacturaLegalTurno(input.clienteId);
  const serial = turno?.serial_activo?.trim();
  if (!serial) return { serial: "", stamped: 0 };

  const pool = getRimecPool();
  let r;
  if (input.stagingId != null) {
    r = await pool.query(
      `
        UPDATE public.${TABLA_BANDEJA}
        SET numero_factura_legal = COALESCE(NULLIF(btrim(numero_factura_legal), ''), $1::text),
            snapshot_json = COALESCE(snapshot_json, '{}'::jsonb) ||
              CASE WHEN NULLIF(btrim(numero_factura_legal), '') IS NULL
                THEN jsonb_build_object('numero_factura_legal', $1::text)
                ELSE '{}'::jsonb END
        WHERE cliente_id = $2 AND staging_id = $3
          AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
      `,
      [serial, input.clienteId, input.stagingId],
    );
  } else if (input.codigos?.length) {
    r = await pool.query(
      `
        UPDATE public.${TABLA_BANDEJA}
        SET numero_factura_legal = COALESCE(NULLIF(btrim(numero_factura_legal), ''), $1::text),
            snapshot_json = COALESCE(snapshot_json, '{}'::jsonb) ||
              CASE WHEN NULLIF(btrim(numero_factura_legal), '') IS NULL
                THEN jsonb_build_object('numero_factura_legal', $1::text)
                ELSE '{}'::jsonb END
        WHERE cliente_id = $2 AND codigo_bandeja = ANY($3::text[])
          AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
      `,
      [serial, input.clienteId, input.codigos],
    );
  } else {
    return { serial, stamped: 0 };
  }
  return { serial, stamped: r.rowCount ?? 0 };
}
