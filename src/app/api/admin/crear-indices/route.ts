import { NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function POST() {
  try {
    const pool = getRimecPool();

    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_funcionarios_ci ON funcionarios(ci)',
      'CREATE INDEX IF NOT EXISTS idx_funcionarios_nombre_completo ON funcionarios(nombre_completo)',
      'CREATE INDEX IF NOT EXISTS idx_funcionarios_activo_apellidos ON funcionarios(activo, apellidos, nombres)',
      'CREATE INDEX IF NOT EXISTS idx_funcionarios_departamento ON funcionarios(departamento) WHERE activo = true',
      'CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo) WHERE activo = true',
      'CREATE INDEX IF NOT EXISTS idx_funcionarios_ente_id ON funcionarios(ente_id) WHERE activo = true',
      'CREATE INDEX IF NOT EXISTS idx_vacaciones_funcionario_anio ON vacaciones(funcionario_id, anio) WHERE activo = true',
      'CREATE INDEX IF NOT EXISTS idx_vacaciones_anio_activo ON vacaciones(anio, activo)',
      'CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_vacacion_id ON vacaciones_detalle(vacacion_id)',
      'CREATE INDEX IF NOT EXISTS idx_vacaciones_detalle_created_at ON vacaciones_detalle(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_entes_codigo ON entes(codigo) WHERE activo = true',
    ];

    const resultados = [];

    for (const sql of indices) {
      try {
        await pool.query(sql);
        const nombreIndice = sql.match(/idx_\w+/)?.[0] || 'unknown';
        resultados.push({ indice: nombreIndice, estado: 'OK' });
      } catch (error) {
        const nombreIndice = sql.match(/idx_\w+/)?.[0] || 'unknown';
        resultados.push({ indice: nombreIndice, estado: 'ERROR', error: String(error) });
      }
    }

    // Analyze tables
    await pool.query('ANALYZE funcionarios');
    await pool.query('ANALYZE vacaciones');
    await pool.query('ANALYZE vacaciones_detalle');
    await pool.query('ANALYZE entes');

    return NextResponse.json({
      success: true,
      mensaje: 'Índices creados',
      indices: resultados,
      total_creados: resultados.filter(r => r.estado === 'OK').length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
