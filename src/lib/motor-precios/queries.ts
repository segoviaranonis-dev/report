import type { Pool } from "pg";
import { esBibliotecaCanonica } from "./constants";

export type BibliotecaRow = {
  id: number;
  nombre: string;
  proveedor_id: number;
  casos_count: number;
  lineas_count: number;
  canonica: boolean;
  activo: boolean;
  descripcion: string | null;
  updated_at: string;
};

export async function listBibliotecasPorProveedor(pool: Pool, proveedorId: number): Promise<BibliotecaRow[]> {
  const { rows } = await pool.query<{
    id: string;
    nombre: string;
    proveedor_id: string;
    casos_count: string;
    lineas_count: string;
    activo: boolean;
    descripcion: string | null;
    updated_at: Date;
  }>(
    `SELECT bp.id, bp.nombre, bp.proveedor_id, bp.descripcion, bp.updated_at, bp.activo,
            COALESCE(c.cnt, 0)::text AS casos_count,
            COALESCE(l.cnt, 0)::text AS lineas_count
     FROM biblioteca_precio bp
     LEFT JOIN (
       SELECT biblioteca_id, COUNT(*) AS cnt
       FROM caso_precio_biblioteca WHERE activo = true GROUP BY biblioteca_id
     ) c ON c.biblioteca_id = bp.id
     LEFT JOIN (
       SELECT biblioteca_id, COUNT(*) AS cnt FROM biblioteca_caso_linea GROUP BY biblioteca_id
     ) l ON l.biblioteca_id = bp.id
     WHERE bp.proveedor_id = $1 AND bp.activo = true
     ORDER BY bp.id DESC`,
    [proveedorId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    nombre: r.nombre,
    proveedor_id: Number(r.proveedor_id),
    casos_count: Number(r.casos_count),
    lineas_count: Number(r.lineas_count),
    canonica: esBibliotecaCanonica(r.nombre),
    activo: r.activo !== false,
    descripcion: r.descripcion,
    updated_at: r.updated_at?.toISOString?.() ?? new Date().toISOString(),
  }));
}

export function findBibliotecaCanonica(bibliotecas: BibliotecaRow[]): BibliotecaRow | null {
  return bibliotecas.find((b) => b.canonica && b.casos_count > 0) ?? bibliotecas.find((b) => b.canonica) ?? null;
}

export async function crearBibliotecaPrecio(
  pool: Pool,
  input: { nombre: string; proveedor_id: number; descripcion?: string | null },
): Promise<{ id: number; nombre: string; proveedor_id: number; descripcion: string | null }> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("Nombre obligatorio");

  try {
    const { rows } = await pool.query<{
      id: string;
      nombre: string;
      proveedor_id: string;
      descripcion: string | null;
    }>(
      `INSERT INTO biblioteca_precio (nombre, proveedor_id, descripcion, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, nombre, proveedor_id, descripcion`,
      [nombre, input.proveedor_id, input.descripcion?.trim() || null],
    );
    const row = rows[0];
    if (!row) throw new Error("No se obtuvo id al crear biblioteca");
    return {
      id: Number(row.id),
      nombre: row.nombre,
      proveedor_id: Number(row.proveedor_id),
      descripcion: row.descripcion,
    };
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505" || err.constraint?.includes("biblioteca_precio")) {
      throw new Error(`Ya existe una biblioteca «${nombre}» para el proveedor ${input.proveedor_id}`);
    }
    throw e;
  }
}
