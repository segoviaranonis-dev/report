/**
 * PP / PROGRAMADO / CP — emparejamiento vendedor comercial.
 *
 * Ley (2026-08-12 · corrige error arquitectura 4.02.03.026):
 * - Cliente **BAZZAR** (tienda): UI/CSV = código **BZZ[SPF]N?** (usuario_v2 tienda).
 *   Matriz Carlos Hoja2 → código **90** (cobrador/slot tienda). NUNCA GIANINA/FRANCIS/…
 * - Cliente RIMEC comercial: `vendedor_v2` vía IC pareada (no login Nexus).
 * - PE Web: ver `vendedor-fi-display.ts` · **4.02.04.004**.
 */
import type { Pool, PoolClient } from "pg";

/** Código Carlos (Hoja2) para todas las cuentas BZZ* tienda. */
export const VENDEDOR_CARLOS_BAZZAR_TIENDA = 90;

const BZZ_TIENDA_RE = /^BZZ[SPF]N?$/i;

export function esUsuarioBzzTienda(descp: string | null | undefined): boolean {
  return BZZ_TIENDA_RE.test(String(descp ?? "").trim());
}

/** Cliente shop Bazzar (razón social en FI). */
export function esClienteBazzarTienda(descpCliente: string | null | undefined): boolean {
  const u = String(descpCliente ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
  return u.includes("BAZZAR") || u.includes("BAZAR");
}

/**
 * Mapa razón social → login tienda BZZ*.
 * Adultos: BZZS / BZZP / BZZF · Niños: BZZSN / BZZPN / BZZFN.
 */
export function resolverCodigoBzzDesdeCliente(
  descpCliente: string | null | undefined,
): "BZZS" | "BZZSN" | "BZZP" | "BZZPN" | "BZZF" | "BZZFN" | null {
  if (!esClienteBazzarTienda(descpCliente)) return null;
  const u = String(descpCliente ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
  const ninos = /\bNIN[OA]S?\b|\bNINOS\b|\bNINAS\b/.test(u) || u.includes("NINOS") || u.includes("NINAS");
  if (u.includes("PALMA")) return ninos ? "BZZPN" : "BZZP";
  if (u.includes("SAN MARTIN")) return ninos ? "BZZSN" : "BZZS";
  if (u.includes("FERNANDO")) return ninos ? "BZZFN" : "BZZF";
  // Razón social corta sin sede (ej. «BAZZAR NINOS DE SERGIO…») = San Martín
  if (ninos) return "BZZSN";
  return null;
}

/**
 * Subtítulo FI PP: vendedor · LP · plazo · marca
 * BZZ* (usuario tienda) gana a vendedor_v2 colisionado (GIANINA≠BZZP).
 */
export const SQL_VENDEDOR_PP_FI_DISPLAY = `
COALESCE(
  CASE
    WHEN UPPER(TRIM(COALESCE(vu_fi.descp_usuario, ''))) ~ '^BZZ[SPF]N?$'
    THEN NULLIF(TRIM(vu_fi.descp_usuario), '')
  END,
  NULLIF(TRIM(vd_ic.descp_vendedor), ''),
  NULLIF(TRIM(vd_fi.descp_vendedor), ''),
  NULLIF(TRIM(vu_fi.descp_usuario), ''),
  '—'
)`.trim();

/** Nombre para CSV Carlos / PDF — misma ley BZZ* → matriz 90. */
export const SQL_VENDEDOR_PP_FI_NOMBRE = `
COALESCE(
  CASE
    WHEN UPPER(TRIM(COALESCE(vu_fi.descp_usuario, ''))) ~ '^BZZ[SPF]N?$'
    THEN NULLIF(BTRIM(vu_fi.descp_usuario), '')
  END,
  NULLIF(BTRIM(vd_ic.descp_vendedor), ''),
  NULLIF(BTRIM(vd_fi.descp_vendedor), ''),
  NULLIF(BTRIM(vu_fi.descp_usuario), ''),
  '—'
)`.trim();

/** JOINs canónicos para las macros SQL_VENDEDOR_PP_*. */
export const SQL_VENDEDOR_PP_FI_JOINS = `
LEFT JOIN vendedor_v2 vd_fi ON vd_fi.id_vendedor = fi.vendedor_id
LEFT JOIN vendedor_v2 vd_ic ON vd_ic.id_vendedor = ic.id_vendedor
LEFT JOIN usuario_v2 vu_fi ON vu_fi.id_usuario = fi.vendedor_id
`.trim();

export type VendedorPpIntegridadIssue = {
  fi_id: number;
  nro_factura: string;
  fi_vendedor_id: number | null;
  ic_nro: string | null;
  ic_vendedor_id: number | null;
  vendedor_ic_nombre: string | null;
  vendedor_fi_v2_nombre: string | null;
  usuario_colision_nombre: string | null;
  label_legacy_usuario: string | null;
  codigo:
    | "COLISION_USUARIO"
    | "DESALINEADO_IC"
    | "SIN_VENDEDOR_V2"
    | "BAZZAR_SIN_BZZ"
    | "BAZZAR_CODIGO_ERRADO";
  mensaje: string;
};

export type VendedorPpIntegridadReport = {
  pp_id: number;
  numero_registro: string | null;
  ok: boolean;
  total_fi: number;
  issues: VendedorPpIntegridadIssue[];
};

const IC_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT ic.id_vendedor, ic.numero_registro
    FROM intencion_compra ic
    JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
    WHERE TRIM(COALESCE(fi.notas, '')) <> ''
      AND TRIM(ic.numero_registro) = TRIM(fi.notas)
    LIMIT 1
  ) ic ON true
`;

const VENDEDOR_JOINS_PP = `
  LEFT JOIN vendedor_v2 vd_fi ON vd_fi.id_vendedor = fi.vendedor_id
  LEFT JOIN vendedor_v2 vd_ic ON vd_ic.id_vendedor = ic.id_vendedor
  LEFT JOIN usuario_v2 vu_fi ON vu_fi.id_usuario = fi.vendedor_id
  LEFT JOIN cliente_v2 cv_fi ON cv_fi.id_cliente = fi.cliente_id
`;

export async function auditarIntegridadVendedorPp(
  pool: Pool,
  ppId: number,
): Promise<VendedorPpIntegridadReport> {
  const ppMeta = await pool.query<{ numero_registro: string | null }>(
    `SELECT numero_registro FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  const { rows } = await pool.query<{
    fi_id: string;
    nro_factura: string;
    fi_vendedor_id: string | null;
    ic_nro: string | null;
    ic_vendedor_id: string | null;
    vendedor_ic_nombre: string | null;
    vendedor_fi_v2_nombre: string | null;
    usuario_colision_nombre: string | null;
    label_legacy_usuario: string | null;
    cliente_nombre: string | null;
  }>(
    `
    SELECT fi.id AS fi_id,
           fi.nro_factura,
           fi.vendedor_id::text AS fi_vendedor_id,
           ic.numero_registro AS ic_nro,
           ic.id_vendedor::text AS ic_vendedor_id,
           vd_ic.descp_vendedor AS vendedor_ic_nombre,
           vd_fi.descp_vendedor AS vendedor_fi_v2_nombre,
           vu_fi.descp_usuario AS usuario_colision_nombre,
           COALESCE(
             NULLIF(TRIM(vu_fi.descp_usuario), ''),
             NULLIF(TRIM(vd_fi.descp_vendedor), ''),
             NULLIF(TRIM(vd_ic.descp_vendedor), '')
           ) AS label_legacy_usuario,
           cv_fi.descp_cliente AS cliente_nombre
    FROM factura_interna fi
    ${IC_LATERAL}
    ${VENDEDOR_JOINS_PP}
    WHERE fi.pp_id = $1
      AND fi.estado <> 'ANULADA'
    ORDER BY fi.nro_factura
    `,
    [ppId],
  );

  const issues: VendedorPpIntegridadIssue[] = [];

  for (const r of rows) {
    const fiVid = r.fi_vendedor_id != null ? Number(r.fi_vendedor_id) : null;
    const icVid = r.ic_vendedor_id != null ? Number(r.ic_vendedor_id) : null;
    const usuario = r.usuario_colision_nombre?.trim() || null;
    const v2Fi = r.vendedor_fi_v2_nombre?.trim() || null;
    const v2Ic = r.vendedor_ic_nombre?.trim() || null;
    const cliente = r.cliente_nombre?.trim() || null;
    const bzzEsperado = resolverCodigoBzzDesdeCliente(cliente);

    // ── Tienda Bazzar: debe ser BZZ* (mapa Carlos 90) ──
    if (bzzEsperado) {
      if (!esUsuarioBzzTienda(usuario)) {
        issues.push({
          fi_id: Number(r.fi_id),
          nro_factura: r.nro_factura,
          fi_vendedor_id: fiVid,
          ic_nro: r.ic_nro,
          ic_vendedor_id: icVid,
          vendedor_ic_nombre: v2Ic,
          vendedor_fi_v2_nombre: v2Fi,
          usuario_colision_nombre: usuario,
          label_legacy_usuario: r.label_legacy_usuario,
          codigo: "BAZZAR_SIN_BZZ",
          mensaje: `Cliente Bazzar «${cliente}» · FI muestra «${usuario ?? v2Fi ?? "—"}» · debe ser ${bzzEsperado} (Carlos ${VENDEDOR_CARLOS_BAZZAR_TIENDA})`,
        });
        continue;
      }
      if (usuario!.toUpperCase() !== bzzEsperado) {
        issues.push({
          fi_id: Number(r.fi_id),
          nro_factura: r.nro_factura,
          fi_vendedor_id: fiVid,
          ic_nro: r.ic_nro,
          ic_vendedor_id: icVid,
          vendedor_ic_nombre: v2Ic,
          vendedor_fi_v2_nombre: v2Fi,
          usuario_colision_nombre: usuario,
          label_legacy_usuario: r.label_legacy_usuario,
          codigo: "BAZZAR_CODIGO_ERRADO",
          mensaje: `Cliente Bazzar · FI=${usuario} · esperado ${bzzEsperado} (niños/adultos · sede)`,
        });
      }
      continue; // BZZ* OK — no aplicar reglas comerciales IC
    }

    // ── Comercial RIMEC: BZZ* en usuario es colisión solo si NO es cliente Bazzar ──
    if (usuario && esUsuarioBzzTienda(usuario) && v2Fi && !esUsuarioBzzTienda(v2Fi)) {
      // ID es login tienda pero cliente no es Bazzar — raro; marcar
      issues.push({
        fi_id: Number(r.fi_id),
        nro_factura: r.nro_factura,
        fi_vendedor_id: fiVid,
        ic_nro: r.ic_nro,
        ic_vendedor_id: icVid,
        vendedor_ic_nombre: v2Ic,
        vendedor_fi_v2_nombre: v2Fi,
        usuario_colision_nombre: usuario,
        label_legacy_usuario: r.label_legacy_usuario,
        codigo: "COLISION_USUARIO",
        mensaje: `fi.vendedor_id=${fiVid} es login «${usuario}» en cliente no-Bazzar — debe ser vendedor_v2 comercial`,
      });
      continue;
    }

    if (usuario && !esUsuarioBzzTienda(usuario) && v2Fi && icVid === fiVid) {
      continue;
    }

    if (
      usuario &&
      !esUsuarioBzzTienda(usuario) &&
      (!v2Fi || usuario.toUpperCase() !== (v2Fi ?? "").toUpperCase())
    ) {
      issues.push({
        fi_id: Number(r.fi_id),
        nro_factura: r.nro_factura,
        fi_vendedor_id: fiVid,
        ic_nro: r.ic_nro,
        ic_vendedor_id: icVid,
        vendedor_ic_nombre: v2Ic,
        vendedor_fi_v2_nombre: v2Fi,
        usuario_colision_nombre: usuario,
        label_legacy_usuario: r.label_legacy_usuario,
        codigo: "COLISION_USUARIO",
        mensaje: `fi.vendedor_id=${fiVid} resuelve usuario «${usuario}» — debe ser vendedor_v2${v2Ic ? ` «${v2Ic}» (IC ${r.ic_nro})` : ""}`,
      });
      continue;
    }

    if (icVid != null && fiVid != null && icVid !== fiVid) {
      issues.push({
        fi_id: Number(r.fi_id),
        nro_factura: r.nro_factura,
        fi_vendedor_id: fiVid,
        ic_nro: r.ic_nro,
        ic_vendedor_id: icVid,
        vendedor_ic_nombre: v2Ic,
        vendedor_fi_v2_nombre: v2Fi,
        usuario_colision_nombre: usuario,
        label_legacy_usuario: r.label_legacy_usuario,
        codigo: "DESALINEADO_IC",
        mensaje: `FI vendedor_id=${fiVid} (${v2Fi ?? "?"}) ≠ IC id_vendedor=${icVid} (${v2Ic ?? "?"})`,
      });
      continue;
    }

    if (icVid != null && !v2Fi && !v2Ic) {
      issues.push({
        fi_id: Number(r.fi_id),
        nro_factura: r.nro_factura,
        fi_vendedor_id: fiVid,
        ic_nro: r.ic_nro,
        ic_vendedor_id: icVid,
        vendedor_ic_nombre: v2Ic,
        vendedor_fi_v2_nombre: v2Fi,
        usuario_colision_nombre: usuario,
        label_legacy_usuario: r.label_legacy_usuario,
        codigo: "SIN_VENDEDOR_V2",
        mensaje: `Sin nombre en vendedor_v2 para FI ${r.nro_factura}`,
      });
    }
  }

  return {
    pp_id: ppId,
    numero_registro: ppMeta.rows[0]?.numero_registro ?? null,
    ok: issues.length === 0,
    total_fi: rows.length,
    issues,
  };
}

export type RepararVendedorPpResult = {
  pp_id: number;
  dry_run: boolean;
  fixed: { fi_id: number; nro_factura: string; from_id: number | null; to_id: number; vendedor: string }[];
  skipped: { fi_id: number; nro_factura: string; reason: string }[];
};

export async function repararVendedorFiDesdeIcPp(
  pool: Pool,
  ppId: number,
  opts: { dryRun?: boolean } = {},
): Promise<RepararVendedorPpResult> {
  const dryRun = opts.dryRun !== false;
  const audit = await auditarIntegridadVendedorPp(pool, ppId);
  const fixed: RepararVendedorPpResult["fixed"] = [];
  const skipped: RepararVendedorPpResult["skipped"] = [];

  const client = await pool.connect();
  try {
    if (!dryRun) await client.query("BEGIN");

    for (const issue of audit.issues) {
      // Bazzar: reparar a usuario_v2 BZZ* (no a IC comercial)
      if (issue.codigo === "BAZZAR_SIN_BZZ" || issue.codigo === "BAZZAR_CODIGO_ERRADO") {
        const { rows: cliRows } = await client.query<{ descp_cliente: string | null }>(
          `SELECT cv.descp_cliente FROM factura_interna fi
           LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
           WHERE fi.id = $1`,
          [issue.fi_id],
        );
        const codigo = resolverCodigoBzzDesdeCliente(cliRows[0]?.descp_cliente ?? null);
        if (!codigo) {
          skipped.push({ fi_id: issue.fi_id, nro_factura: issue.nro_factura, reason: "sin mapa BZZ" });
          continue;
        }
        const { rows: uRows } = await client.query<{ id_usuario: string; descp_usuario: string }>(
          `SELECT id_usuario::text, descp_usuario FROM usuario_v2
           WHERE UPPER(TRIM(descp_usuario)) = $1 LIMIT 1`,
          [codigo],
        );
        if (!uRows[0]) {
          skipped.push({
            fi_id: issue.fi_id,
            nro_factura: issue.nro_factura,
            reason: `usuario ${codigo} no existe`,
          });
          continue;
        }
        const toId = Number(uRows[0].id_usuario);
        if (!dryRun) {
          await syncVendedorFiPp(client, issue.fi_id, toId);
        }
        fixed.push({
          fi_id: issue.fi_id,
          nro_factura: issue.nro_factura,
          from_id: issue.fi_vendedor_id,
          to_id: toId,
          vendedor: uRows[0].descp_usuario,
        });
        continue;
      }

      if (issue.ic_vendedor_id == null || issue.ic_vendedor_id <= 0) {
        skipped.push({
          fi_id: issue.fi_id,
          nro_factura: issue.nro_factura,
          reason: "IC sin id_vendedor",
        });
        continue;
      }

      const vendCheck = await client.query<{ descp_vendedor: string }>(
        `SELECT descp_vendedor FROM vendedor_v2 WHERE id_vendedor = $1`,
        [issue.ic_vendedor_id],
      );
      if (!vendCheck.rows[0]) {
        skipped.push({
          fi_id: issue.fi_id,
          nro_factura: issue.nro_factura,
          reason: `id_vendedor ${issue.ic_vendedor_id} no existe en vendedor_v2`,
        });
        continue;
      }

      const nombre = vendCheck.rows[0].descp_vendedor;

      if (!dryRun) {
        await syncVendedorFiPp(client, issue.fi_id, issue.ic_vendedor_id);
      }

      fixed.push({
        fi_id: issue.fi_id,
        nro_factura: issue.nro_factura,
        from_id: issue.fi_vendedor_id,
        to_id: issue.ic_vendedor_id,
        vendedor: nombre,
      });
    }

    if (!dryRun) await client.query("COMMIT");
  } catch (e) {
    if (!dryRun) await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return { pp_id: ppId, dry_run: dryRun, fixed, skipped };
}

/** FI + IC pareada + logistica_pendiente_confirmacion */
export async function syncVendedorFiPp(
  client: PoolClient,
  fiId: number,
  vendedorId: number,
): Promise<void> {
  await client.query(`UPDATE factura_interna SET vendedor_id = $2 WHERE id = $1`, [fiId, vendedorId]);

  await client.query(
    `
    UPDATE intencion_compra ic
    SET id_vendedor = $2
    FROM factura_interna fi
    JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = fi.pp_id
    WHERE fi.id = $1
      AND ic.id = icp.intencion_compra_id
      AND TRIM(COALESCE(fi.notas, '')) <> ''
      AND TRIM(ic.numero_registro) = TRIM(fi.notas)
    `,
    [fiId, vendedorId],
  );

  await client.query(
    `UPDATE logistica_pendiente_confirmacion SET id_vendedor = $2, updated_at = now()
     WHERE factura_interna_id = $1`,
    [fiId, vendedorId],
  );
}
