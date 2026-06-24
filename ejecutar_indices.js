const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'aws-0-sa-east-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.wjqljsnqesrwbbtzvztx',
  password: 'Z9JzvQLjyX3f',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function ejecutar() {
  try {
    const sql = fs.readFileSync('./migrations/090_indices_performance_rrhh.sql', 'utf8');

    console.log('Ejecutando índices de performance...\n');
    await pool.query(sql);

    console.log('[OK] Índices creados correctamente\n');

    // Verificar índices
    const { rows } = await pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('funcionarios', 'vacaciones', 'vacaciones_detalle', 'entes')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    console.log('ÍNDICES CREADOS:');
    rows.forEach(r => {
      console.log(`  ${r.tablename}.${r.indexname}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

ejecutar();
