import { NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function GET() {
  try {
    const pool = getRimecPool();

    const result = await pool.query(`
      UPDATE vacaciones
      SET
        tipo_vacacion = 'MIXTO',
        horas_totales = dias_totales * 8.0,
        updated_at = NOW()
      WHERE anio = 2026 AND activo = true
      RETURNING id_vacacion, funcionario_id, tipo_vacacion, dias_totales, horas_totales
    `);

    const verificar = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tipo_vacacion = 'MIXTO') as mixto_count,
        COUNT(*) FILTER (WHERE horas_totales > 0) as con_horas
      FROM vacaciones
      WHERE anio = 2026 AND activo = true
    `);

    return NextResponse.json({
      success: true,
      actualizados: result.rowCount,
      verificacion: verificar.rows[0]
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
