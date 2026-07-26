import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { normalizePeBatchLabel } from "@/lib/stock-pronta-entrega/vincular-biblioteca-pe";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";

type MolKey = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
};

function parseMoleculeKey(raw: string): MolKey | null {
  const parts = String(raw ?? "").split("-");
  if (parts.length < 4) return null;
  const color = parts.pop()!;
  const material = parts.pop()!;
  const referencia = parts.pop()!;
  const linea = parts.join("-");
  if (!linea || !referencia) return null;
  return { linea, referencia, material, color };
}

/** GET ?batch= → mapa molécula → % */
export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: gate.error.status });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "BD no configurada" }, { status: 503 });
  }

  const batch = normalizePeBatchLabel(req.nextUrl.searchParams.get("batch"));
  const pool = getRimecPool();
  try {
    const { rows } = await pool.query<{
      linea_codigo: string;
      referencia_codigo: string;
      material_code: string;
      color_code: string;
      descuento_pct: string;
    }>(
      `SELECT linea_codigo, referencia_codigo, material_code, color_code, descuento_pct::text
       FROM pe_descuento_comercial_molecula
       WHERE lower(batch_label) = lower($1) OR batch_label = ''`,
      [batch],
    );
    const map: Record<string, number> = {};
    for (const r of rows) {
      const k = moleculeKeyVentas(
        r.linea_codigo,
        r.referencia_codigo,
        r.material_code,
        r.color_code,
      );
      const pct = Number(r.descuento_pct);
      if (!Number.isFinite(pct)) continue;
      // Preferir fila con batch concreto (ya filtrada); vacío global solo si no hay)
      if (map[k] == null) map[k] = pct;
    }
    return NextResponse.json({ ok: true, batch, descuentos: map, count: Object.keys(map).length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** POST { batch, pct, molecule_keys[] } → upsert BD */
export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: gate.error.status });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "BD no configurada" }, { status: 503 });
  }

  const body = (await req.json()) as {
    batch?: string;
    pct?: number;
    molecule_keys?: string[];
  };
  const batch = normalizePeBatchLabel(body.batch);
  const pct = Number(body.pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ ok: false, error: "pct inválido" }, { status: 400 });
  }
  const keys = Array.isArray(body.molecule_keys) ? body.molecule_keys : [];
  if (keys.length === 0) {
    return NextResponse.json({ ok: false, error: "sin moléculas" }, { status: 400 });
  }

  const mols: MolKey[] = [];
  for (const k of keys) {
    const p = parseMoleculeKey(k);
    if (p) mols.push(p);
  }
  if (mols.length === 0) {
    return NextResponse.json({ ok: false, error: "claves inválidas" }, { status: 400 });
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  const who = gate.session?.name ?? "report";
  try {
    await client.query("BEGIN");
    let upserted = 0;
    for (const m of mols) {
      await client.query(
        `INSERT INTO pe_descuento_comercial_molecula
           (batch_label, linea_codigo, referencia_codigo, material_code, color_code,
            descuento_pct, assigned_by, assigned_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
         ON CONFLICT (batch_label, linea_codigo, referencia_codigo, material_code, color_code)
         DO UPDATE SET
           descuento_pct = EXCLUDED.descuento_pct,
           assigned_by = EXCLUDED.assigned_by,
           assigned_at = now(),
           updated_at = now()`,
        [batch, m.linea, m.referencia, m.material, m.color, pct, who],
      );
      upserted += 1;
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, batch, pct, upserted });
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
