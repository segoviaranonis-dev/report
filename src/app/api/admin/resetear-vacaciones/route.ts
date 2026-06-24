import { NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function POST() {
  try {
    const pool = getRimecPool();

    // 1. ELIMINAR todos los registros de vacaciones_detalle
    const { rowCount: detalleEliminados } = await pool.query(`
      DELETE FROM vacaciones_detalle
    `);

    // 2. RESETEAR todos los contadores a 0 en vacaciones
    const { rowCount: vacacionesActualizadas } = await pool.query(`
      UPDATE vacaciones
      SET
        dias_tomados = 0,
        horas_tomadas = 0.00,
        updated_at = NOW()
      WHERE anio = 2026 AND activo = true
    `);

    // 3. Verificar que todo esté en 0
    const { rows: verificacion } = await pool.query(`
      SELECT
        COUNT(*) as total_funcionarios,
        SUM(dias_tomados) as total_dias_tomados,
        SUM(horas_tomadas) as total_horas_tomadas,
        COUNT(*) FILTER (WHERE dias_tomados > 0) as con_dias_tomados,
        COUNT(*) FILTER (WHERE horas_tomadas > 0) as con_horas_tomadas
      FROM vacaciones
      WHERE anio = 2026 AND activo = true
    `);

    const { rows: detalleVerificacion } = await pool.query(`
      SELECT COUNT(*) as total_registros
      FROM vacaciones_detalle
    `);

    return NextResponse.json({
      success: true,
      mensaje: '✅ BASE DE DATOS LIMPIA - TODO EN 0',
      operaciones: {
        detalle_eliminados: detalleEliminados,
        vacaciones_reseteadas: vacacionesActualizadas,
      },
      verificacion: {
        total_funcionarios: verificacion[0].total_funcionarios,
        total_dias_tomados: verificacion[0].total_dias_tomados,
        total_horas_tomadas: verificacion[0].total_horas_tomadas,
        funcionarios_con_dias: verificacion[0].con_dias_tomados,
        funcionarios_con_horas: verificacion[0].con_horas_tomadas,
        registros_detalle: detalleVerificacion[0].total_registros,
      },
      estado: verificacion[0].total_dias_tomados === '0' &&
              verificacion[0].total_horas_tomadas === '0.00' &&
              detalleVerificacion[0].total_registros === '0'
        ? '✅ ENTREGA LISTA - TODO EN 0'
        : '❌ ERROR - HAY DATOS RESIDUALES'
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
