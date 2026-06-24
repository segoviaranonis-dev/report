import { NextRequest, NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ci = searchParams.get('ci') || '5031163';

    const pool = getRimecPool();

    // Datos principales
    const { rows } = await pool.query(`
      SELECT
        f.id_funcionario,
        f.nombre_completo,
        f.ci,
        v.id_vacacion,
        v.anio,
        v.tipo_vacacion,
        v.dias_totales,
        v.dias_tomados,
        v.dias_pendientes,
        v.horas_totales,
        v.horas_tomadas,
        v.horas_pendientes
      FROM funcionarios f
      LEFT JOIN vacaciones v ON v.funcionario_id = f.id_funcionario AND v.anio = 2026
      WHERE f.ci = $1
    `, [ci]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Funcionario no encontrado' }, { status: 404 });
    }

    const funcionario = rows[0];

    // Historial detalle
    const { rows: detalle } = await pool.query(`
      SELECT
        vd.id_detalle,
        vd.fecha_inicio,
        vd.fecha_fin,
        vd.dias_tomados,
        vd.horas_tomadas,
        vd.estado,
        vd.created_at
      FROM vacaciones_detalle vd
      INNER JOIN vacaciones v ON v.id_vacacion = vd.vacacion_id
      WHERE v.funcionario_id = $1 AND v.anio = 2026
      ORDER BY vd.created_at DESC
    `, [funcionario.id_funcionario]);

    return NextResponse.json({
      funcionario,
      historial: detalle,
      total_registros: detalle.length
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
