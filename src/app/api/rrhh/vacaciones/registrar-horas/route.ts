import { NextRequest, NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function POST(request: NextRequest) {
  try {
    const { funcionario_id, fecha, horas_tomadas, anio } = await request.json();
    const pool = getRimecPool();

    console.log('[API registrar-horas] 📥 REQUEST:', { funcionario_id, fecha, horas_tomadas, anio });

    const dias_equiv = Math.floor(horas_tomadas / 8);

    // SINGLE QUERY: Insert + Update atómico (INSERT DEBE EJECUTARSE)
    const { rows, rowCount } = await pool.query(
      `WITH vacacion_actual AS (
        SELECT id_vacacion FROM vacaciones
        WHERE funcionario_id = $1 AND anio = $2 AND activo = true
        LIMIT 1
      ),
      insertar_detalle AS (
        INSERT INTO vacaciones_detalle (vacacion_id, fecha_inicio, fecha_fin, dias_tomados, horas_tomadas, estado, created_at)
        SELECT id_vacacion, $3, $3, $4, $5, 'aprobado', NOW()
        FROM vacacion_actual
        RETURNING id_detalle, vacacion_id
      )
      UPDATE vacaciones v
      SET horas_tomadas = horas_tomadas + $5,
          dias_tomados = dias_tomados + $4,
          updated_at = NOW()
      FROM vacacion_actual va, insertar_detalle id
      WHERE v.id_vacacion = va.id_vacacion
        AND v.id_vacacion = id.vacacion_id
      RETURNING v.id_vacacion, v.horas_totales, v.horas_tomadas, v.horas_pendientes, v.dias_tomados, v.dias_pendientes`,
      [funcionario_id, anio, fecha, dias_equiv, horas_tomadas]
    );

    console.log('[API registrar-horas] 📊 QUERY RESULT:', { rowCount, rows });

    if (!rows || rows.length === 0) {
      console.error('[API registrar-horas] ❌ UPDATE no retornó filas - El funcionario NO existe o el UPDATE falló');
      return NextResponse.json({
        error: 'No se pudo actualizar el registro de vacaciones. Verificar que el funcionario tenga vacaciones inicializadas para el año ' + anio
      }, { status: 400 });
    }

    console.log('[API registrar-horas] ✅ EXITOSO:', rows[0]);

    return NextResponse.json({
      success: true,
      vacacion: rows[0],
      mensaje: `✅ ${horas_tomadas}h registradas (Total ahora: ${rows[0].horas_tomadas}h)`
    });

  } catch (error) {
    console.error('[API registrar-horas] ❌ ERROR:', error);
    return NextResponse.json({
      error: 'Error al registrar horas',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
