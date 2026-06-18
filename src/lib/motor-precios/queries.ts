import type { Pool } from "pg";
import { BIBLIOTECA_CANONICA_NOMBRE, esBibliotecaCanonica } from "./constants";

export type BibliotecaRow = {
  id: number;
  proveedor_id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  casos_count: number;
  lineas_count: number;
  canonica: boolean;
};

export async function listBibliotecas(pool: Pool, proveedorId: number): Promise<BibliotecaRow[]> {
  const { rows } = await pool.query<{
    id: string;
    proveedor_id: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
    created_at: Date;
    updated_at: Date;
    casos_count: string;
    lineas_count: string;
  }>(
    `SELECT bp.id, bp.proveedor_id, bp.nombre, bp.descripcion, bp.activo,
            bp.created_at, bp.updated_at,
            COALESCE(c.cnt, 0)::text AS casos_count,
            COALESCE(l.cnt, 0)::text AS lineas_count
     FROM biblioteca_precio bp
     LEFT JOIN (
       SELECT biblioteca_id, COUNT(*) AS cnt
       FROM caso_precio_biblioteca
       WHERE activo = true AND biblioteca_id IS NOT NULL
       GROUP BY biblioteca_id
     ) c ON c.biblioteca_id = bp.id
     LEFT JOIN (
       SELECT biblioteca_id, COUNT(*) AS cnt
       FROM biblioteca_caso_linea
       GROUP BY biblioteca_id
     ) l ON l.biblioteca_id = bp.id
     WHERE bp.proveedor_id = $1 AND bp.activo = true
     ORDER BY
       CASE WHEN bp.nombre = $2 OR bp.nombre ILIKE '%1905%' THEN 0 ELSE 1 END,
       bp.nombre`,
    [proveedorId, BIBLIOTECA_CANONICA_NOMBRE],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    proveedor_id: Number(r.proveedor_id),
    nombre: r.nombre,
    descripcion: r.descripcion,
    activo: r.activo,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    casos_count: Number(r.casos_count),
    lineas_count: Number(r.lineas_count),
    canonica: esBibliotecaCanonica(r.nombre),
  }));
}

export async function crearBiblioteca(
  pool: Pool,
  proveedorId: number,
  nombre: string,
  descripcion: string | null,
): Promise<{ id: number; nombre: string }> {
  const nom = nombre.trim();
  if (!nom) throw new Error("El nombre de la biblioteca es obligatorio.");

  const { rows } = await pool.query<{ id: string; nombre: string }>(
    `INSERT INTO biblioteca_precio (proveedor_id, nombre, descripcion)
     VALUES ($1, $2, $3)
     ON CONFLICT (proveedor_id, nombre) DO UPDATE
       SET activo = true, descripcion = COALESCE(EXCLUDED.descripcion, biblioteca_precio.descripcion), updated_at = now()
     RETURNING id, nombre`,
    [proveedorId, nom, descripcion?.trim() || null],
  );

  if (!rows[0]) throw new Error("No se obtuvo id al crear la biblioteca.");
  return { id: Number(rows[0].id), nombre: rows[0].nombre };
}

export async function getBibliotecaCanonica(pool: Pool, proveedorId: number): Promise<BibliotecaRow | null> {
  const list = await listBibliotecas(pool, proveedorId);
  return list.find((b) => b.canonica) ?? null;
}
