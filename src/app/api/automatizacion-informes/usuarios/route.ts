import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * GET · usuarios activos con email para multi-select destinatarios.
 */
export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const r = await pool.query<{
      id_usuario: number;
      nombre: string;
      email: string;
      categoria: string | null;
      rol_id: number | null;
    }>(
      `
      SELECT
        u.id_usuario,
        TRIM(u.descp_usuario) AS nombre,
        LOWER(TRIM(u.email)) AS email,
        u.categoria,
        u.rol_id
      FROM public.usuario_v2 u
      WHERE COALESCE(u.bloqueado, false) = false
        AND u.email IS NOT NULL
        AND TRIM(u.email) <> ''
        AND u.email NOT ILIKE '%@placeholder%'
      ORDER BY TRIM(u.descp_usuario)
      LIMIT 500
      `,
    );

    return NextResponse.json({
      ok: true,
      usuarios: r.rows.map((u) => ({
        id: Number(u.id_usuario),
        nombre: u.nombre,
        email: u.email,
        categoria: u.categoria,
        rol_id: u.rol_id,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error usuarios";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
