import type { Pool } from "pg";
import { generoCodigoPorMarca, normalizarMarca } from "./ley-genero";

/** Parsea código STYLE entero (1184.100 → 1184). */
export function parseCodigoPilar(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "—" || s === "-") return null;
  const head = s.split(/[.\s]/)[0]?.replace(/[^\d]/g, "") ?? "";
  const n = parseInt(head, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type PilaresResueltos = {
  linea_id: number;
  referencia_id: number;
  material_id: number;
};

async function lookupGeneroId(pool: Pool, marca: string): Promise<number | null> {
  const cod = generoCodigoPorMarca(marca);
  if (!cod) return null;
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM genero WHERE UPPER(TRIM(codigo)) = UPPER(TRIM($1)) LIMIT 1`,
    [cod],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function lookupMarcaId(pool: Pool, marca: string): Promise<number | null> {
  const norm = normalizarMarca(marca);
  if (!norm) return null;
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM marca_v2 WHERE UPPER(TRIM(descp_marca)) = $1 LIMIT 1`,
    [norm],
  );
  if (rows[0]) return Number(rows[0].id);
  const { rows: fuzzy } = await pool.query<{ id: string }>(
    `SELECT id FROM marca_v2 WHERE UPPER(descp_marca) LIKE $1 LIMIT 1`,
    [`%${norm.split(" ")[0]}%`],
  );
  return fuzzy[0] ? Number(fuzzy[0].id) : null;
}

async function getOrCreateLinea(
  pool: Pool,
  proveedorId: number,
  codigo: number,
  marca: string,
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM linea WHERE proveedor_id = $1 AND codigo_proveedor = $2 LIMIT 1`,
    [proveedorId, codigo],
  );
  if (rows[0]) return Number(rows[0].id);

  const generoId = (await lookupGeneroId(pool, marca)) ?? null;
  const marcaId = (await lookupMarcaId(pool, marca)) ?? null;

  const ins = await pool.query<{ id: string }>(
    `INSERT INTO linea (codigo_proveedor, proveedor_id, genero_id, marca_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [codigo, proveedorId, generoId, marcaId],
  );
  if (ins.rows[0]) return Number(ins.rows[0].id);

  const retry = await pool.query<{ id: string }>(
    `SELECT id FROM linea WHERE proveedor_id = $1 AND codigo_proveedor = $2 LIMIT 1`,
    [proveedorId, codigo],
  );
  if (!retry.rows[0]) throw new Error(`No se pudo crear línea ${codigo}`);
  return Number(retry.rows[0].id);
}

async function getOrCreateReferencia(pool: Pool, lineaId: number, codigo: number): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM referencia WHERE linea_id = $1 AND codigo_proveedor = $2 LIMIT 1`,
    [lineaId, codigo],
  );
  if (rows[0]) return Number(rows[0].id);

  const ins = await pool.query<{ id: string }>(
    `INSERT INTO referencia (linea_id, codigo_proveedor)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [lineaId, codigo],
  );
  if (ins.rows[0]) return Number(ins.rows[0].id);

  const retry = await pool.query<{ id: string }>(
    `SELECT id FROM referencia WHERE linea_id = $1 AND codigo_proveedor = $2 LIMIT 1`,
    [lineaId, codigo],
  );
  if (!retry.rows[0]) throw new Error(`No se pudo crear referencia ${codigo}`);
  return Number(retry.rows[0].id);
}

async function getOrCreateMaterial(pool: Pool, proveedorId: number, codigo: number): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM material WHERE proveedor_id = $1 AND codigo_proveedor = $2 LIMIT 1`,
    [proveedorId, codigo],
  );
  if (rows[0]) return Number(rows[0].id);

  const ins = await pool.query<{ id: string }>(
    `INSERT INTO material (codigo_proveedor, proveedor_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [codigo, proveedorId],
  );
  if (ins.rows[0]) return Number(ins.rows[0].id);

  const retry = await pool.query<{ id: string }>(
    `SELECT id FROM material WHERE proveedor_id = $1 AND codigo_proveedor = $2 LIMIT 1`,
    [proveedorId, codigo],
  );
  if (!retry.rows[0]) throw new Error(`No se pudo crear material ${codigo}`);
  return Number(retry.rows[0].id);
}

export async function resolverPilaresSku(
  pool: Pool,
  proveedorId: number,
  sku: { marca: string; linea: string; referencia: string; material: string },
): Promise<PilaresResueltos | null> {
  const lineaCod = parseCodigoPilar(sku.linea);
  const refCod = parseCodigoPilar(sku.referencia);
  const matCod = parseCodigoPilar(sku.material);
  if (lineaCod == null || refCod == null || matCod == null) return null;

  const linea_id = await getOrCreateLinea(pool, proveedorId, lineaCod, sku.marca);
  const referencia_id = await getOrCreateReferencia(pool, linea_id, refCod);
  const material_id = await getOrCreateMaterial(pool, proveedorId, matCod);
  return { linea_id, referencia_id, material_id };
}
