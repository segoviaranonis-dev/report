import { getDepositoByClienteId } from "@/lib/depositos/depositos-config";
import { getRimecPool } from "@/lib/rimec/pool";
import { TABLA_BANDEJA } from "./pos-tables";

type Molecula = {
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number;
  grada: string;
};

function sqlIncrementarUnParMolecula(tabla: string, p: Molecula): { text: string; params: unknown[] } {
  const grada = p.grada.trim();
  return {
    text: `
      UPDATE public.${tabla} s
      SET cantidad = cantidad + 1
      WHERE s.id = (
        SELECT id
        FROM public.${tabla}
        WHERE linea_id = $1
          AND referencia_id = $2
          AND material_id = $3
          AND color_id = $4
          AND btrim(grada::text) = $5
        ORDER BY id
        FOR UPDATE
        LIMIT 1
      )
    `,
    params: [p.linea_id, p.referencia_id, p.material_id, p.color_id, grada],
  };
}

export type ActualizarTitularInput = {
  clienteId: number;
  stagingId: number | null;
  codigos: string[];
  cedula: string;
  nombre: string;
  apellido?: string | null;
  ruc?: string | null;
  telefono?: string | null;
  email?: string | null;
};

export async function actualizarTitularFacturaEmitida(
  input: ActualizarTitularInput,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const cedula = input.cedula.replace(/\D/g, "").trim();
  if (cedula.length < 5) return { ok: false, error: "Cédula inválida (mín. 5 dígitos)" };

  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, error: "Nombre requerido" };

  const apellido = input.apellido?.trim() || null;
  const ruc = input.ruc?.replace(/\D/g, "").trim() || null;
  const telefono = input.telefono?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  if (telefono && (telefono.length < 6 || telefono.length > 20 || !/^[0-9+\-\s()]+$/.test(telefono))) {
    return { ok: false, error: "Celular inválido (6–20 caracteres)" };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
    return { ok: false, error: "Correo electrónico inválido" };
  }
  const codigos = input.codigos.filter(Boolean);
  if (!codigos.length && input.stagingId == null) {
    return { ok: false, error: "Factura sin identificador" };
  }

  const pool = getRimecPool();
  const snapPatch = JSON.stringify({
    nombre_cliente: nombre,
    apellido_cliente: apellido,
    cedula_cliente: cedula,
    ruc_cliente: ruc,
    telefono_cliente: telefono,
    email_cliente: email,
  });
  const stagingSnap = JSON.stringify({
    nombre,
    apellido,
    telefono,
    email,
    cedula,
    ruc,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let updateR;
    if (input.stagingId != null) {
      updateR = await client.query(
        `
          UPDATE public.${TABLA_BANDEJA}
          SET cedula_cliente = $1,
              snapshot_json = COALESCE(snapshot_json, '{}'::jsonb) || $2::jsonb
          WHERE cliente_id = $3
            AND staging_id = $4
            AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
        `,
        [cedula, snapPatch, input.clienteId, input.stagingId],
      );
    } else {
      updateR = await client.query(
        `
          UPDATE public.${TABLA_BANDEJA}
          SET cedula_cliente = $1,
              snapshot_json = COALESCE(snapshot_json, '{}'::jsonb) || $2::jsonb
          WHERE cliente_id = $3
            AND codigo_bandeja = ANY($4::text[])
            AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
        `,
        [cedula, snapPatch, input.clienteId, codigos],
      );
    }

    if (!updateR.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Factura no encontrada o ya facturada" };
    }

    if (input.stagingId != null) {
      await client.query(
        `
          UPDATE public.${TABLA_BANDEJA}
          SET snapshot_cliente = $1::jsonb
          WHERE staging_id = $2 AND cliente_id = $3
            AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
        `,
        [stagingSnap, input.stagingId, input.clienteId],
      );
    }

    if (ruc || telefono || email) {
      await client.query(
        `
          UPDATE public.clients_bazaar
          SET
            ruc = CASE WHEN $1::text IS NOT NULL AND $1 <> '' THEN $1 ELSE ruc END,
            telefono = CASE WHEN $2::text IS NOT NULL AND $2 <> '' THEN $2 ELSE telefono END,
            email = CASE WHEN $3::text IS NOT NULL AND $3 <> '' THEN $3 ELSE email END,
            updated_at = NOW()
          WHERE cedula = $4
        `,
        [ruc, telefono, email, cedula],
      );
    }

    await client.query("COMMIT");
    return { ok: true, updated: updateR.rowCount ?? 0 };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar titular" };
  } finally {
    client.release();
  }
}

export async function eliminarLineaEmitida(
  codigoTicket: string,
  clienteId: number,
): Promise<{ ok: true; restantes: number } | { ok: false; error: string }> {
  const pool = getRimecPool();
  const config = getDepositoByClienteId(clienteId);
  if (!config) return { ok: false, error: "Depósito de tienda inválido" };

  const cur = await pool.query<{
    codigo_ticket: string;
    staging_id: number | null;
    linea_id: number;
    referencia_id: number;
    material_id: number;
    color_id: number;
    grada: string;
  }>(
    `
      SELECT codigo_bandeja AS codigo_ticket, staging_id, linea_id, referencia_id, material_id, color_id, grada
      FROM public.${TABLA_BANDEJA}
      WHERE codigo_bandeja = $1 AND cliente_id = $2
        AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
    `,
    [codigoTicket, clienteId],
  );
  const row = cur.rows[0];
  if (!row) return { ok: false, error: "Línea no encontrada o ya facturada" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const del = await client.query(
      `DELETE FROM public.${TABLA_BANDEJA}
       WHERE codigo_bandeja = $1 AND cliente_id = $2
         AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')`,
      [codigoTicket, clienteId],
    );
    if (!del.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "No se pudo eliminar la línea" };
    }

    const inc = sqlIncrementarUnParMolecula(config.tabla, {
      linea_id: row.linea_id,
      referencia_id: row.referencia_id,
      material_id: row.material_id,
      color_id: row.color_id,
      grada: row.grada,
    });
    await client.query(inc.text, inc.params);

    if (row.staging_id != null) {
      const rest = await client.query<{ n: string }>(
        `
          SELECT COUNT(*)::text AS n FROM public.${TABLA_BANDEJA}
          WHERE staging_id = $1
            AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
            AND activo = true
        `,
        [row.staging_id],
      );
      const restantes = Number(rest.rows[0]?.n ?? 0);
      if (restantes === 0) {
        await client.query(
          `
            UPDATE public.${TABLA_BANDEJA}
            SET estado = 'ABIERTO', cerrado_at = NULL
            WHERE staging_id = $1 AND cliente_id = $2
          `,
          [row.staging_id, clienteId],
        );
      }

      await client.query("COMMIT");
      return { ok: true, restantes };
    }

    await client.query("COMMIT");
    return { ok: true, restantes: 0 };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar línea" };
  } finally {
    client.release();
  }
}
