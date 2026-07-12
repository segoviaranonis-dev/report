/**
 * Sincroniza PELE desde biblioteca BCL (eventos cerrados OK) y regenera FI Chusa
 * para todos los PP PROGRAMADO con stock.
 *
 * Uso:
 *   npx tsx scripts/reemparejar_casos_pf_programado.ts [--dry-run] [--solo-sync] [--solo-fi] [ppId...]
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { construirParejasLoteChusa } from "../src/lib/pedido-proveedor/administrador-ic-monto";
import { loadAdministradorIcPp } from "../src/lib/pedido-proveedor/administrador-ic-query";
import { generarFiDesdeAdministradorIc } from "../src/lib/pedido-proveedor/administrador-ic-generar-fi";
import { borrarFiReservadasProgramado } from "../src/lib/pedido-proveedor/proforma-programado-engine";
import { getRimecPool } from "../src/lib/rimec/pool";
import { loadMapaCasoPorLineaEvento } from "../src/lib/motor-precios/caso-linea-evento";

const PROVEEDOR_ID = 654;

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const dryRun = process.argv.includes("--dry-run");
const soloSync = process.argv.includes("--solo-sync");
const soloFi = process.argv.includes("--solo-fi");
const ppFilter = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map(Number)
  .filter(Number.isFinite);

function normCaso(s: string): string {
  return String(s ?? "")
    .replace(/\*/g, "")
    .trim()
    .toUpperCase();
}

async function syncPeleDesdeBiblioteca(
  pool: pg.Pool,
  eventoId: number,
  bibliotecaId: number,
): Promise<{ ok: boolean; n_insert: number; n_sin_caso_evento: number; error?: string }> {
  const casosEv = await pool.query<{ id: number; nombre_caso: string }>(
    `SELECT id::int, nombre_caso FROM precio_evento_caso WHERE evento_id = $1`,
    [eventoId],
  );
  const casoIdPorNombre = new Map<string, number>();
  for (const r of casosEv.rows) {
    casoIdPorNombre.set(normCaso(r.nombre_caso), r.id);
  }

  const bcl = await pool.query<{ linea_id: number; cod: string; nombre_caso: string }>(
    `SELECT l.id::int AS linea_id,
            l.codigo_proveedor::text AS cod,
            cpb.nombre_caso
     FROM biblioteca_caso_linea bcl
     JOIN linea l ON l.id = bcl.linea_id
     JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
     WHERE bcl.biblioteca_id = $1 AND cpb.activo = true`,
    [bibliotecaId],
  );

  const filas: Array<{ linea_id: number; caso_id: number; cod: string }> = [];
  let nSinCaso = 0;
  for (const r of bcl.rows) {
    const casoId = casoIdPorNombre.get(normCaso(r.nombre_caso));
    if (!casoId) {
      nSinCaso++;
      continue;
    }
    filas.push({ linea_id: r.linea_id, caso_id: casoId, cod: r.cod });
  }

  if (dryRun) {
    const peleAntes = await loadMapaCasoPorLineaEvento(pool, eventoId);
    let cambios = 0;
    for (const f of filas) {
      const cod = String(Math.trunc(Number(f.cod)));
      const antes = peleAntes.get(cod) ?? "—";
      const despues = [...casoIdPorNombre.entries()].find(([, id]) => id === f.caso_id)?.[0] ?? "?";
      if (normCaso(antes) !== normCaso(despues)) cambios++;
    }
    return { ok: true, n_insert: filas.length, n_sin_caso_evento: nSinCaso, error: `dry-run: ${cambios} líneas PELE distintas` };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM precio_evento_linea_excepcion WHERE evento_id = $1`, [eventoId]);

    const CHUNK = 500;
    for (let i = 0; i < filas.length; i += CHUNK) {
      const slice = filas.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const tuples = slice.map((f, idx) => {
        const base = idx * 3;
        values.push(f.caso_id, f.linea_id, eventoId);
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      });
      await client.query(
        `INSERT INTO precio_evento_linea_excepcion (caso_id, linea_id, evento_id)
         VALUES ${tuples.join(", ")}
         ON CONFLICT DO NOTHING`,
        values,
      );
    }
    await client.query(`UPDATE precio_evento SET biblioteca_precio_id = $1 WHERE id = $2`, [
      bibliotecaId,
      eventoId,
    ]);
    await client.query("COMMIT");
    return { ok: true, n_insert: filas.length, n_sin_caso_evento: nSinCaso };
  } catch (e) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      n_insert: 0,
      n_sin_caso_evento: nSinCaso,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    client.release();
  }
}

async function regenerarPpChusa(pool: pg.Pool, ppId: number) {
  const meta = await pool.query<{ numero_registro: string }>(
    "SELECT numero_registro FROM pedido_proveedor WHERE id = $1",
    [ppId],
  );
  const label = meta.rows[0]?.numero_registro ?? String(ppId);

  const del = await borrarFiReservadasProgramado(ppId);
  if (!del.ok) {
    return { ppId, label, ok: false, error: del.error ?? "borrar FI" };
  }

  const { ics, prefacturas } = await loadAdministradorIcPp(pool, ppId);
  const lote = construirParejasLoteChusa(ics, prefacturas);
  if (!lote.ok) {
    return {
      ppId,
      label,
      ok: false,
      error: lote.error,
      chusa: lote.chusa,
      n_pf: prefacturas.length,
      n_ic: ics.length,
    };
  }

  const generadas: string[] = [];
  for (const p of lote.parejas) {
    const result = await generarFiDesdeAdministradorIc(pool, ppId, p.ic_id, p.ppd_ids);
    if (!result.ok) {
      return { ppId, label, ok: false, error: result.error, fallo_ic: p.ic_nro, generadas };
    }
    generadas.push(result.fi_nro!);
  }

  const carteras = prefacturas.filter((pf) => normCaso(pf.caso) === "CARTERAS");

  return {
    ppId,
    label,
    ok: true,
    fi_borradas: del.n ?? 0,
    fi_creadas: generadas.length,
    n_ic: ics.length,
    n_pf: prefacturas.length,
    n_pf_carteras: carteras.length,
    chusa_n1: lote.chusa?.nivel1 ?? false,
  };
}

async function main() {
  const pool = getRimecPool();

  const { rows: eventos } = await pool.query<{
    evento_id: number;
    biblioteca_id: number;
  }>(
    `SELECT DISTINCT icp.precio_evento_id::int AS evento_id,
            pe.biblioteca_precio_id::int AS biblioteca_id
     FROM pedido_proveedor pp
     JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
     JOIN precio_evento pe ON pe.id = icp.precio_evento_id
     WHERE pp.categoria_id = 3
       AND icp.precio_evento_id IS NOT NULL
       AND pe.biblioteca_precio_id IS NOT NULL
     ORDER BY 1`,
  );

  console.log("\n=== SYNC PELE ← BCL ===\n");
  if (!soloFi) {
    for (const ev of eventos) {
      console.log(`Evento ${ev.evento_id} ← biblioteca ${ev.biblioteca_id}`);
      const r = await syncPeleDesdeBiblioteca(pool, ev.evento_id, ev.biblioteca_id);
      console.log(JSON.stringify(r));
      if (!r.ok) {
        console.error("Abortando — sync PELE falló");
        process.exit(1);
      }
    }
  }

  const { rows: pps } = await pool.query<{ id: number; numero_registro: string; ppd: number }>(
    `SELECT pp.id::int, pp.numero_registro,
            (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = pp.id) AS ppd
     FROM pedido_proveedor pp
     WHERE pp.categoria_id = 3
     ORDER BY pp.id`,
  );

  const targets = pps.filter((p) => p.ppd > 0 && (ppFilter.length === 0 || ppFilter.includes(p.id)));

  console.log("\n=== REGENERAR FI + PF (Chusa) ===\n");
  const results = [];
  if (!soloSync) {
    for (const p of targets) {
      console.log(`--- ${p.numero_registro} (id ${p.id}) ---`);
      if (dryRun) {
        const { prefacturas } = await loadAdministradorIcPp(pool, p.id);
        const carteras = prefacturas.filter((pf) => normCaso(pf.caso) === "CARTERAS");
        console.log(JSON.stringify({ dry_run: true, n_pf: prefacturas.length, n_pf_carteras: carteras.length }));
        results.push({ ppId: p.id, ok: true, dry_run: true });
        continue;
      }
      const r = await regenerarPpChusa(pool, p.id);
      console.log(JSON.stringify(r));
      results.push(r);
    }
  }

  // Auditoría carteras post-sync
  console.log("\n=== AUDITORÍA CARTERAS (líneas PP programado × PELE) ===\n");
  const { rows: alertas } = await pool.query<{
    pp: string;
    linea: string;
    material: string;
    caso_pele: string;
  }>(
    `WITH pp_prog AS (
       SELECT pp.id, pp.numero_registro, icp.precio_evento_id AS evento_id
       FROM pedido_proveedor pp
       JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
       WHERE pp.categoria_id = 3 AND icp.precio_evento_id IS NOT NULL
     ),
     lineas AS (
       SELECT DISTINCT p.numero_registro AS pp, p.evento_id,
              TRIM(d.linea) AS linea,
              COALESCE(d.descp_material, '') AS material
       FROM pp_prog p
       JOIN pedido_proveedor_detalle d ON d.pedido_proveedor_id = p.id
       WHERE TRIM(d.linea) <> ''
     )
     SELECT ln.pp, ln.linea, ln.material,
            COALESCE(pec.nombre_caso, '—') AS caso_pele
     FROM lineas ln
     LEFT JOIN linea l ON l.proveedor_id = $1
       AND l.codigo_proveedor::text = ln.linea
     LEFT JOIN precio_evento_linea_excepcion pele
       ON pele.evento_id = ln.evento_id AND pele.linea_id = l.id
     LEFT JOIN precio_evento_caso pec ON pec.id = pele.caso_id
     WHERE (
       UPPER(ln.material) ~ 'BAG|CARTER|BOLSA|BOLSO|STR\\s+B'
       OR ln.linea ~ '^(100|101|110|200|250|500)'
     )
     AND UPPER(COALESCE(pec.nombre_caso, '')) <> 'CARTERAS'
     ORDER BY ln.pp, ln.linea
     LIMIT 50`,
    [PROVEEDOR_ID],
  );
  console.log(`Alertas cartera fuera de CARTERAS: ${alertas.length}`);
  if (alertas.length) console.table(alertas);

  const failed = results.filter((r) => r && !r.ok);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
