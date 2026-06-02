/**
 * Script diagnóstico: verificar datos retail para filtros
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no configurada');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  console.log('🔍 Diagnóstico filtros Retail\n');

  // 1. Listar batches
  const batchesRes = await pool.query(`
    SELECT
      batch_id,
      archivo_origen,
      batch_label,
      COUNT(*) as filas
    FROM registro_st_vt_rc_reposicion
    GROUP BY batch_id, archivo_origen, batch_label
    ORDER BY MAX(created_at) DESC
    LIMIT 5
  `);

  console.log('📦 Batches disponibles:');
  batchesRes.rows.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.batch_label || b.archivo_origen || b.batch_id.slice(0, 8)} (${b.filas} filas)`);
  });

  const batchId = batchesRes.rows[0]?.batch_id;
  if (!batchId) {
    console.log('\n❌ No hay batches');
    await pool.end();
    return;
  }

  console.log(`\n📊 Analizando batch: ${batchesRes.rows[0].batch_label || batchId.slice(0, 8)}\n`);

  // 2. Contar nulls en FK
  const nullsRes = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(genero_id) as con_genero,
      COUNT(marca_id) as con_marca,
      COUNT(grupo_estilo_id) as con_estilo,
      COUNT(*) - COUNT(genero_id) as sin_genero,
      COUNT(*) - COUNT(marca_id) as sin_marca,
      COUNT(*) - COUNT(grupo_estilo_id) as sin_estilo
    FROM registro_st_vt_rc_reposicion
    WHERE batch_id = $1
  `, [batchId]);

  const stats = nullsRes.rows[0];
  console.log('🔢 Completitud de FK:');
  console.log(`  Total filas: ${stats.total}`);
  console.log(`  Con género: ${stats.con_genero} (${stats.sin_genero} sin)`);
  console.log(`  Con marca: ${stats.con_marca} (${stats.sin_marca} sin)`);
  console.log(`  Con estilo: ${stats.con_estilo} (${stats.sin_estilo} sin)`);

  // 3. Listar marcas disponibles
  const marcasRes = await pool.query(`
    SELECT
      s.marca_id,
      m.descp_marca,
      COUNT(*) as filas
    FROM registro_st_vt_rc_reposicion s
    LEFT JOIN marca_v2 m ON m.id_marca = s.marca_id
    WHERE s.batch_id = $1 AND s.marca_id IS NOT NULL
    GROUP BY s.marca_id, m.descp_marca
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `, [batchId]);

  console.log(`\n🏷️  Top marcas (con FK):`)
;
  marcasRes.rows.forEach(m => {
    console.log(`  ${m.descp_marca || `ID ${m.marca_id}`}: ${m.filas} filas`);
  });

  // 4. Listar géneros
  const generosRes = await pool.query(`
    SELECT
      s.genero_id,
      g.descripcion,
      COUNT(*) as filas
    FROM registro_st_vt_rc_reposicion s
    LEFT JOIN genero g ON g.id = s.genero_id
    WHERE s.batch_id = $1 AND s.genero_id IS NOT NULL
    GROUP BY s.genero_id, g.descripcion
    ORDER BY COUNT(*) DESC
  `, [batchId]);

  console.log(`\n👥 Géneros (con FK):`);
  generosRes.rows.forEach(g => {
    console.log(`  ${g.descripcion || `ID ${g.genero_id}`}: ${g.filas} filas`);
  });

  // 5. Listar estilos
  const estilosRes = await pool.query(`
    SELECT
      s.grupo_estilo_id,
      ge.descp_grupo_estilo,
      COUNT(*) as filas
    FROM registro_st_vt_rc_reposicion s
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
    WHERE s.batch_id = $1 AND s.grupo_estilo_id IS NOT NULL
    GROUP BY s.grupo_estilo_id, ge.descp_grupo_estilo
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `, [batchId]);

  console.log(`\n🎨 Top estilos (con FK):`);
  estilosRes.rows.forEach(e => {
    console.log(`  ${e.descp_grupo_estilo || `ID ${e.grupo_estilo_id}`}: ${e.filas} filas`);
  });

  // 6. Prueba filtro Vizzano
  const vizzanoRes = await pool.query(`
    SELECT marca_id, COUNT(*) as filas
    FROM registro_st_vt_rc_reposicion s
    LEFT JOIN marca_v2 m ON m.id_marca = s.marca_id
    WHERE s.batch_id = $1
      AND LOWER(m.descp_marca) LIKE '%vizzano%'
    GROUP BY marca_id
  `, [batchId]);

  if (vizzanoRes.rows.length > 0) {
    console.log(`\n🔍 Filtro "Vizzano":`);
    vizzanoRes.rows.forEach(v => {
      console.log(`  marca_id=${v.marca_id}: ${v.filas} filas`);
    });
  } else {
    console.log(`\n⚠️  No hay filas con marca "Vizzano" en este batch`);
  }

  await pool.end();
  console.log('\n✅ Diagnóstico completado');
}

main().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
