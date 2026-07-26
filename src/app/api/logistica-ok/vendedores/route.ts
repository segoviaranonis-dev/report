import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** GET · catálogo vendedores para multi-asignación Logística OK */
export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const { rows } = await pool.query<{ id_vendedor: string; descp_vendedor: string }>(
      `
      SELECT id_vendedor::text, COALESCE(descp_vendedor, '—') AS descp_vendedor
      FROM vendedor_v2
      WHERE COALESCE(descp_vendedor, '') <> ''
      ORDER BY descp_vendedor
      LIMIT 200
      `,
    );
    return NextResponse.json({
      ok: true,
      vendedores: rows.map((r) => ({
        id: Number(r.id_vendedor),
        nombre: r.descp_vendedor,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
