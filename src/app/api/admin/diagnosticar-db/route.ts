import { NextRequest, NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ci = searchParams.get('ci') || '5031163';

    const pool = getRimecPool();

    // 1. Datos en tabla vacaciones
    const { rows: vacacionesRows } = await pool.query(`
      SELECT
        v.id_vacacion,
        v.funcionario_id,
        v.anio,
        v.tipo_vacacion,
        v.dias_totales,
        v.dias_tomados,
        v.dias_pendientes,
        v.horas_totales,
        v.horas_tomadas,
        v.horas_pendientes,
        f.nombre_completo,
        f.ci
      FROM vacaciones v
      INNER JOIN funcionarios f ON f.id_funcionario = v.funcionario_id
      WHERE f.ci = $1 AND v.anio = 2026
    `, [ci]);

    if (vacacionesRows.length === 0) {
      return NextResponse.json({ error: 'Funcionario no encontrado' }, { status: 404 });
    }

    const vacacion = vacacionesRows[0];

    // 2. Datos en tabla vacaciones_detalle
    const { rows: detalleRows } = await pool.query(`
      SELECT
        vd.id_detalle,
        vd.fecha_inicio,
        vd.fecha_fin,
        vd.dias_tomados,
        vd.horas_tomadas,
        vd.estado,
        vd.created_at
      FROM vacaciones_detalle vd
      WHERE vd.vacacion_id = $1
      ORDER BY vd.created_at DESC
    `, [vacacion.id_vacacion]);

    // 3. Calcular totales desde detalle
    const totalDiasDetalle = detalleRows.reduce((sum, d) => sum + Number(d.dias_tomados), 0);
    const totalHorasDetalle = detalleRows.reduce((sum, d) => sum + Number(d.horas_tomadas), 0);

    // 4. Comparación
    const inconsistencia = {
      dias: vacacion.dias_tomados !== totalDiasDetalle,
      horas: vacacion.horas_tomadas !== totalHorasDetalle,
    };

    return NextResponse.json({
      funcionario: {
        id: vacacion.funcionario_id,
        nombre: vacacion.nombre_completo,
        ci: vacacion.ci,
      },
      tabla_vacaciones: {
        id_vacacion: vacacion.id_vacacion,
        funcionario_id: vacacion.funcionario_id,
        dias_tomados: vacacion.dias_tomados,
        horas_tomadas: vacacion.horas_tomadas,
        dias_pendientes: vacacion.dias_pendientes,
        horas_pendientes: vacacion.horas_pendientes,
      },
      tabla_detalle: {
        total_registros: detalleRows.length,
        dias_suma: totalDiasDetalle,
        horas_suma: totalHorasDetalle,
        registros: detalleRows,
      },
      inconsistencia: inconsistencia,
      solucion: inconsistencia.dias || inconsistencia.horas
        ? 'RECALCULAR CONTADORES'
        : 'DATOS CONSISTENTES',
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
