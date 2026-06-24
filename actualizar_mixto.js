const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.wjqljsnqesrwbbtzvztx:Z9JzvQLjyX3f@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
});

async function actualizarMixto() {
  try {
    console.log('Actualizando TODOS los funcionarios a sistema MIXTO...\n');

    const result = await pool.query(`
      UPDATE vacaciones
      SET
        tipo_vacacion = 'MIXTO',
        horas_totales = dias_totales * 8.0,
        updated_at = NOW()
      WHERE anio = 2026 AND activo = true
      RETURNING id_vacacion, funcionario_id, tipo_vacacion, dias_totales, horas_totales
    `);

    console.log(`[OK] ${result.rowCount} funcionarios actualizados a MIXTO\n`);

    const verificar = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tipo_vacacion = 'MIXTO') as mixto_count,
        COUNT(*) FILTER (WHERE horas_totales > 0) as con_horas
      FROM vacaciones
      WHERE anio = 2026 AND activo = true
    `);

    console.log('VERIFICACION:');
    console.log(`  Total funcionarios: ${verificar.rows[0].total}`);
    console.log(`  Con tipo MIXTO: ${verificar.rows[0].mixto_count}`);
    console.log(`  Con horas > 0: ${verificar.rows[0].con_horas}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

actualizarMixto();
