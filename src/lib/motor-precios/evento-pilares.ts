import type { Pool } from "pg";
import { generoCodigoPorMarca, normalizarMarca, CODIGOS_GENERO_BD } from "./ley-genero";

/** Parsea código STYLE entero (1184.100 → 1184). */
export function parseCodigoPilar(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "—" || s === "-") return null;
  const head = s.split(/[.\s]/)[0]?.replace(/[^\d]/g, "") ?? "";
  const n = parseInt(head, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Código pilar línea (STYLE entero) — casos biblioteca usan solo línea, nunca referencia. */
export function codigoLineaDesdeSku(sku: { linea: string }): string | null {
  const n = parseCodigoPilar(sku.linea);
  return n != null ? String(n) : null;
}

export type PilaresResueltos = {
  linea_id: number;
  referencia_id: number;
  material_id: number;
};

async function lookupGeneroId(pool: Pool, marca: string): Promise<number | null> {
  const cod = generoCodigoPorMarca(marca);
  if (!cod) return null;
  const variantes = CODIGOS_GENERO_BD[cod] ?? [cod];
  for (const v of variantes) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM genero
       WHERE COALESCE(activo, true)
         AND (
           UPPER(TRIM(codigo)) = UPPER(TRIM($1))
           OR UPPER(TRIM(COALESCE(descripcion, ''))) = UPPER(TRIM($1))
         )
       LIMIT 1`,
      [v],
    );
    if (rows[0]) return Number(rows[0].id);
  }
  return null;
}

async function lookupMarcaId(pool: Pool, marca: string): Promise<number | null> {
  const norm = normalizarMarca(marca);
  if (!norm) return null;
  const { rows } = await pool.query<{ id_marca: string }>(
    `SELECT id_marca FROM marca_v2 WHERE UPPER(TRIM(descp_marca::text)) = $1 LIMIT 1`,
    [norm],
  );
  if (rows[0]) return Number(rows[0].id_marca);
  const { rows: fuzzy } = await pool.query<{ id_marca: string }>(
    `SELECT id_marca FROM marca_v2 WHERE UPPER(descp_marca::text) LIKE $1 LIMIT 1`,
    [`%${norm.split(" ")[0]}%`],
  );
  return fuzzy[0] ? Number(fuzzy[0].id_marca) : null;
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
     ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
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

async function getOrCreateReferencia(
  pool: Pool,
  proveedorId: number,
  lineaId: number,
  codigo: number,
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND codigo_proveedor = $3
     LIMIT 1`,
    [proveedorId, lineaId, codigo],
  );
  if (rows[0]) return Number(rows[0].id);

  const ins = await pool.query<{ id: string }>(
    `INSERT INTO referencia (linea_id, codigo_proveedor, proveedor_id, activo)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (proveedor_id, linea_id, codigo_proveedor) DO NOTHING
     RETURNING id`,
    [lineaId, codigo, proveedorId],
  );
  if (ins.rows[0]) return Number(ins.rows[0].id);

  const retry = await pool.query<{ id: string }>(
    `SELECT id FROM referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND codigo_proveedor = $3
     LIMIT 1`,
    [proveedorId, lineaId, codigo],
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
     ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
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

export async function asegurarLineaEnPilar(
  pool: Pool,
  proveedorId: number,
  codigoLinea: number,
  marca: string,
): Promise<number> {
  return getOrCreateLinea(pool, proveedorId, codigoLinea, marca);
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
  const referencia_id = await getOrCreateReferencia(pool, proveedorId, linea_id, refCod);
  const material_id = await getOrCreateMaterial(pool, proveedorId, matCod);
  return { linea_id, referencia_id, material_id };
}

/** Índice en memoria — evita N×SELECT en Paso 3 (2388 SKUs en Vercel). */
export class PilaresBulkResolver {
  private readonly lineaByCod = new Map<number, number>();
  private readonly refByKey = new Map<string, number>();
  private readonly matByCod = new Map<number, number>();

  constructor(
    private readonly pool: Pool,
    private readonly proveedorId: number,
  ) {}

  async preload(): Promise<void> {
    const [lineas, refs, mats] = await Promise.all([
      this.pool.query<{ id: string; codigo_proveedor: string }>(
        `SELECT id, codigo_proveedor::text FROM linea WHERE proveedor_id = $1`,
        [this.proveedorId],
      ),
      this.pool.query<{ id: string; linea_id: string; codigo_proveedor: string }>(
        `SELECT id, linea_id::text, codigo_proveedor::text FROM referencia WHERE proveedor_id = $1`,
        [this.proveedorId],
      ),
      this.pool.query<{ id: string; codigo_proveedor: string }>(
        `SELECT id, codigo_proveedor::text FROM material WHERE proveedor_id = $1`,
        [this.proveedorId],
      ),
    ]);
    for (const r of lineas.rows) {
      const cod = parseInt(r.codigo_proveedor, 10);
      if (Number.isFinite(cod)) this.lineaByCod.set(cod, Number(r.id));
    }
    for (const r of refs.rows) {
      const refCod = parseInt(r.codigo_proveedor, 10);
      if (Number.isFinite(refCod)) {
        this.refByKey.set(`${r.linea_id}:${refCod}`, Number(r.id));
      }
    }
    for (const r of mats.rows) {
      const cod = parseInt(r.codigo_proveedor, 10);
      if (Number.isFinite(cod)) this.matByCod.set(cod, Number(r.id));
    }
  }

  private resolveCached(
    sku: { marca: string; linea: string; referencia: string; material: string },
  ): PilaresResueltos | null {
    const lineaCod = parseCodigoPilar(sku.linea);
    const refCod = parseCodigoPilar(sku.referencia);
    const matCod = parseCodigoPilar(sku.material);
    if (lineaCod == null || refCod == null || matCod == null) return null;

    const linea_id = this.lineaByCod.get(lineaCod);
    const material_id = this.matByCod.get(matCod);
    if (!linea_id || !material_id) return null;

    const referencia_id = this.refByKey.get(`${linea_id}:${refCod}`);
    if (!referencia_id) return null;

    return { linea_id, referencia_id, material_id };
  }

  async resolveOrEnsure(
    sku: { marca: string; linea: string; referencia: string; material: string },
  ): Promise<PilaresResueltos | null> {
    const hit = this.resolveCached(sku);
    if (hit) return hit;

    const lineaCod = parseCodigoPilar(sku.linea);
    const refCod = parseCodigoPilar(sku.referencia);
    const matCod = parseCodigoPilar(sku.material);
    if (lineaCod == null || refCod == null || matCod == null) return null;

    let linea_id = this.lineaByCod.get(lineaCod);
    if (!linea_id) {
      linea_id = await getOrCreateLinea(this.pool, this.proveedorId, lineaCod, sku.marca);
      this.lineaByCod.set(lineaCod, linea_id);
    }

    const refKey = `${linea_id}:${refCod}`;
    let referencia_id = this.refByKey.get(refKey);
    if (!referencia_id) {
      referencia_id = await getOrCreateReferencia(this.pool, this.proveedorId, linea_id, refCod);
      this.refByKey.set(refKey, referencia_id);
    }

    let material_id = this.matByCod.get(matCod);
    if (!material_id) {
      material_id = await getOrCreateMaterial(this.pool, this.proveedorId, matCod);
      this.matByCod.set(matCod, material_id);
    }

    return { linea_id, referencia_id, material_id };
  }
}
