import { NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function POST() {
  try {
    const pool = getRimecPool();

    // 1. EMILIA BERNAL como JEFE DE POST VENTA
    await pool.query(`
      UPDATE funcionarios
      SET jerarquia_organizacional = 'JEFE'
      WHERE nombre_completo ILIKE '%EMILIA%BERNAL%'
    `);

    // 2. GUIDO QUESADA como SUBJEFE (primer al mando bajo Emilia)
    await pool.query(`
      UPDATE funcionarios
      SET jerarquia_organizacional = 'SUBJEFE_1'
      WHERE nombre_completo ILIKE '%GUIDO%QUESADA%'
    `);

    // 3. VERONICA ACUÑA como SUBJEFE_2 (segunda bajo Emilia)
    await pool.query(`
      UPDATE funcionarios
      SET jerarquia_organizacional = 'SUBJEFE_2'
      WHERE nombre_completo ILIKE '%VERONICA%ACUÑA%' OR nombre_completo ILIKE '%VERONICA%ACUNA%'
    `);

    // 4. ELIZABETH AMARILLA como JEFE DE LIMPIEZA
    await pool.query(`
      UPDATE funcionarios
      SET jerarquia_organizacional = 'JEFE'
      WHERE nombre_completo ILIKE '%ELIZABETH%AMARILLA%'
    `);

    // 5. Todos los demás en POST VENTA se agrupan bajo Emilia
    await pool.query(`
      UPDATE funcionarios
      SET jerarquia_organizacional = 'MIEMBRO'
      WHERE departamento ILIKE '%POST%VENTA%'
      AND jerarquia_organizacional IS NULL
    `);

    // 6. Todos los demás en LIMPIEZA se agrupan bajo Elizabeth
    await pool.query(`
      UPDATE funcionarios
      SET jerarquia_organizacional = 'MIEMBRO'
      WHERE departamento ILIKE '%LIMPIEZA%'
      AND jerarquia_organizacional IS NULL
    `);

    // Verificar resultados
    const { rows } = await pool.query(`
      SELECT
        nombre_completo,
        departamento,
        jerarquia_organizacional
      FROM funcionarios
      WHERE jerarquia_organizacional IN ('JEFE', 'SUBJEFE_1', 'SUBJEFE_2')
      ORDER BY departamento, jerarquia_organizacional
    `);

    return NextResponse.json({
      success: true,
      mensaje: 'Jerarquía actualizada',
      jefes: rows
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
