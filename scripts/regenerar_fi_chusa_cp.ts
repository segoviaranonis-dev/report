/**
 * Regenera FI vía Protocolo Chusa (Administrador IC) — CP programado.
 * npx tsx scripts/regenerar_fi_chusa_cp.ts [ppId ...]
 * Default: 021,015,016,018,022,017,023 (excluye 019 id 28).
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

import { construirParejasLoteChusa } from "../src/lib/pedido-proveedor/administrador-ic-monto";
import { loadAdministradorIcPp } from "../src/lib/pedido-proveedor/administrador-ic-query";
import { generarFiDesdeAdministradorIc } from "../src/lib/pedido-proveedor/administrador-ic-generar-fi";
import { borrarFiReservadasProgramado } from "../src/lib/pedido-proveedor/proforma-programado-engine";
import { getRimecPool } from "../src/lib/rimec/pool";

const DEFAULT_PP = [30, 15, 25, 27, 31, 26, 32];

async function regenerarPp(pool: ReturnType<typeof getRimecPool>, ppId: number) {
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
      return {
        ppId,
        label,
        ok: false,
        error: result.error,
        fallo_ic: p.ic_nro,
        generadas,
      };
    }
    generadas.push(result.fi_nro!);
  }

  return {
    ppId,
    label,
    ok: true,
    fi_borradas: del.n ?? 0,
    fi_creadas: generadas.length,
    n_ic: ics.length,
    n_pf: prefacturas.length,
    chusa: lote.chusa,
  };
}

async function main() {
  const ppIds = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const targets = ppIds.length ? ppIds : DEFAULT_PP;
  const pool = getRimecPool();
  const results = [];

  for (const ppId of targets) {
    if (ppId === 28) {
      console.log(JSON.stringify({ ppId, skip: true, reason: "PP-019 ejemplo — no tocar" }));
      continue;
    }
    console.log(`\n--- Regenerando PP id ${ppId} ---`);
    const r = await regenerarPp(pool, ppId);
    console.log(JSON.stringify(r, null, 2));
    results.push(r);
  }

  const failed = results.filter((r) => r && !r.ok);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
