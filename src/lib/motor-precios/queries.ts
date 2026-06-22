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
