const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.wjqljsnqesrwbbtzvztx:Z9JzvQLjyX3f@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
});

async function verificar() {
  try {
    // Buscar DIEGO MANUEL ACOSTA BAEZ (CI: 5031163)
    const result = await pool.query(`
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
      WHERE f.ci = '5031163'
    `);

    console.log('\n=== DIEGO MANUEL ACOSTA BAEZ (CI: 5031163) ===\n');

    if (result.rows.length === 0) {
      console.log('[ERROR] Funcionario no encontrado');
    } else {
      const row = result.rows[0];
      console.log('Funcionario ID:', row.id_funcionario);
      console.log('Nombre:', row.nombre_completo);
      console.log('CI:', row.ci);
      console.log('\nVACACIONES 2026:');
      console.log('  Tipo:', row.tipo_vacacion);
      console.log('  Días totales:', row.dias_totales);
      console.log('  Días tomados:', row.dias_tomados);
      console.log('  Días pendientes:', row.dias_pendientes);
      console.log('  Horas totales:', row.horas_totales);
      console.log('  Horas tomadas:', row.horas_tomadas);
      console.log('  Horas pendientes:', row.horas_pendientes);

      // Verificar detalle de vacaciones
      const detalle = await pool.query(`
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
      `, [row.id_funcionario]);

      console.log('\nHISTORIAL DE REGISTROS:');
      if (detalle.rows.length === 0) {
        console.log('  [NINGUNO]');
      } else {
        detalle.rows.forEach((d, i) => {
          console.log(`\n  Registro ${i + 1}:`);
          console.log(`    ID: ${d.id_detalle}`);
          console.log(`    Fecha: ${d.fecha_inicio} → ${d.fecha_fin}`);
          console.log(`    Días: ${d.dias_tomados}`);
          console.log(`    Horas: ${d.horas_tomadas}`);
          console.log(`    Estado: ${d.estado}`);
          console.log(`    Creado: ${d.created_at}`);
        });
      }
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

verificar();
