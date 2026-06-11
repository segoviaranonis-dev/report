import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isNivelDios } from "@/lib/auth/nivel-dios";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** Auditoría Nivel Dios — solo sesión DIOS. */
export async function GET() {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return NextResponse.json({ error: "Nivel Dios requerido" }, { status: 403 });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const pool = getRimecPool();
  const { rows: autorizados } = await pool.query<{
    id_usuario: number;
    descp_usuario: string;
    categoria: string;
    rol_id: number;
  }>(`
    SELECT id_usuario, descp_usuario, categoria, rol_id
    FROM usuario_v2
    WHERE rol_id = 1 AND UPPER(TRIM(categoria)) = 'DIOS'
    ORDER BY descp_usuario
  `);

  const { rows: guido } = await pool.query<{
    id_usuario: number;
    descp_usuario: string;
    categoria: string;
    rol_id: number;
  }>(`
    SELECT id_usuario, descp_usuario, categoria, rol_id
    FROM usuario_v2
    WHERE UPPER(descp_usuario) LIKE '%GUIDO%'
    ORDER BY descp_usuario
  `);

  const guidoEsUnico =
    autorizados.length === 1 &&
    guido.some((g) => g.id_usuario === autorizados[0]?.id_usuario);

  return NextResponse.json({
    sesion: { name: session?.name, rol_id: session?.rol_id, role: session?.role },
    total_dios: autorizados.length,
    autorizados,
    guido,
    guido_es_unico_nivel_dios: guidoEsUnico,
  });
}
