import type { PoolClient } from "pg";
import {
  COLORES_ESTANDAR_DEFAULT,
  estandarToTono,
  sugerirColorEstandarFromCatalog,
} from "@/lib/pilares/colores-estandar";
import { colorPredominante, normalizarEtiqueta, parseTonoCanon, tonoSolido } from "@/lib/pilares/color-canon";

/** Cliente transaccional pg (PoolClient o Client). */
export type PgQueryable = Pick<PoolClient, "query">;

function parseCodigoProveedor(codigo: string): number {
  const s = String(codigo ?? "").trim();
  if (!/^\d+$/.test(s)) throw new Error(`codigo_proveedor inválido: ${codigo}`);
  return Number.parseInt(s, 10);
}

export async function upsertMaterialProforma(
  client: PgQueryable,
  codigo: string,
  proveedorId: number,
  descripcion: string | null | undefined,
): Promise<void> {
  const desc = String(descripcion ?? "").trim();
  if (!desc) return;
  const cod = parseCodigoProveedor(codigo);
  await client.query(
    `INSERT INTO material (codigo_proveedor, proveedor_id, descripcion, activo)
     VALUES ($1::bigint, $2::bigint, $3, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO UPDATE SET
       descripcion = CASE
         WHEN EXCLUDED.descripcion IS NOT NULL AND btrim(EXCLUDED.descripcion) <> ''
         THEN EXCLUDED.descripcion
         ELSE material.descripcion
       END`,
    [cod, proveedorId, desc.slice(0, 2000)],
  );
}

function tonoSinAsignar(raw: unknown): boolean {
  const tono = parseTonoCanon(raw);
  return !tono?.etiqueta?.trim();
}

export async function upsertColorProforma(
  client: PgQueryable,
  codigo: string,
  proveedorId: number,
  nombre: string | null | undefined,
): Promise<void> {
  const nom = String(nombre ?? "").trim();
  if (!nom) return;
  const cod = parseCodigoProveedor(codigo);

  const ins = await client.query<{ id: number; tono_canon: unknown }>(
    `INSERT INTO color (codigo_proveedor, proveedor_id, nombre, activo)
     VALUES ($1::bigint, $2::bigint, $3, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO UPDATE SET
       nombre = CASE
         WHEN EXCLUDED.nombre IS NOT NULL AND btrim(EXCLUDED.nombre) <> ''
         THEN EXCLUDED.nombre
         ELSE color.nombre
       END
     RETURNING id, tono_canon`,
    [cod, proveedorId, nom.slice(0, 2000)],
  );

  const colorId = ins.rows[0]?.id;
  if (!colorId) return;

  const tonoRaw = ins.rows[0].tono_canon;
  if (!tonoSinAsignar(tonoRaw)) return;

  const predominante = colorPredominante(nom);
  const sug = sugerirColorEstandarFromCatalog(predominante || nom, COLORES_ESTANDAR_DEFAULT);
  const tono = sug
    ? estandarToTono(sug)
    : predominante
      ? tonoSolido(normalizarEtiqueta(predominante), "#94a3b8")
      : null;
  if (!tono) return;
  const hexWeb = tono.tipo === "solido" ? tono.hex : (tono.swatches[0] ?? "#64748b");

  await client.query(
    `UPDATE color
     SET tono_canon = $1::jsonb,
         hex_web = CASE WHEN hex_web IS NULL OR btrim(hex_web) = '' THEN $2 ELSE hex_web END
     WHERE id = $3
       AND (tono_canon IS NULL OR btrim(tono_canon->>'etiqueta') = '')`,
    [JSON.stringify(tono), hexWeb, colorId],
  );
}

/** Clave molécula estable — paridad Python json.dumps(grades, sort_keys=True). */
export function canonicalMolKey(
  linea: string,
  referencia: string,
  materialCode: string,
  colorCode: string,
  grades: Record<string, number> | null | undefined,
): string {
  const gj = grades ?? {};
  const sortedGrades: Record<string, number> = {};
  for (const k of Object.keys(gj).sort()) {
    sortedGrades[k] = Number(gj[k]) || 0;
  }
  return JSON.stringify([linea, referencia, materialCode, colorCode, sortedGrades]);
}

export function categoriaEsProgramado(categoriaId: unknown): boolean {
  return Number(categoriaId) === 3;
}
