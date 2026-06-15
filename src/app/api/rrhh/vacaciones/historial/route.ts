import { NextRequest, NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const funcionario_id = parseInt(searchParams.get('funcionario_id') || '0');
    const anio = parseInt(searchParams.get('anio') || new Date().getFullYear().toString());

    if (!funcionario_id) {
      return NextResponse.json({ error: 'funcionario_id requerido' }, { status: 400 });
    }

    const pool = getRimecPool();

    const { rows } = await pool.query(
      `SELECT
        vd.id_detalle,
        vd.fecha_inicio,
        vd.fecha_fin,
        vd.dias_tomados,
        vd.horas_tomadas,
        vd.estado,
        vd.created_at
      FROM vacaciones_detalle vd
      INNER JOIN vacaciones v ON v.id_vacacion = vd.vacacion_id
      WHERE v.funcionario_id = $1 AND v.anio = $2 AND v.activo = true
      ORDER BY vd.created_at DESC`,
      [funcionario_id, anio]
    );

    return NextResponse.json({ historial: rows });
  } catch (error) {
    console.error('[API historial]', error);
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
