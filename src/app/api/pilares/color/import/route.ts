import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id, proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import {
  importColorRowsUpsert,
  parseColorXlsxBuffer,
  POLITICA_IDIOMA_COLOR,
} from "@/lib/pilares/import-color-xlsx";
import {
  ensureTonoCanonColumn,
  loadAndRecalcColoresEstandar,
  suggestTonoCanonBulk,
} from "@/lib/pilares/queries";
import type { TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  return NextResponse.json({ politica: POLITICA_IDIOMA_COLOR });
}

export async function POST(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const tipoV2Id = parseTipoV2Id(String(form.get("tipo_v2_id") ?? 1)) as TipoV2Id;
    const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
    if (proveedorId == null) {
      return NextResponse.json({ ok: false, error: "tipo_v2_id inválido" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Archivo xlsx requerido" }, { status: 400 });
    }

    const suggestTono = form.get("suggest_tono") === "1";
    const buf = Buffer.from(await file.arrayBuffer());
    const rows = parseColorXlsxBuffer(buf);
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Sin filas válidas (COLOR CODE + COLOR)" }, { status: 400 });
    }

    const pool = getRimecPool();
    await ensureTonoCanonColumn(pool);
    const importResult = await importColorRowsUpsert(pool, proveedorId, rows);

    let tono_suggested = 0;
    if (suggestTono) {
      const catalog = await loadAndRecalcColoresEstandar(pool, proveedorId);
      tono_suggested = await suggestTonoCanonBulk(pool, proveedorId, catalog);
    }

    return NextResponse.json({
      ok: true,
      proveedor_id: proveedorId,
      ...importResult,
      tono_suggested,
      politica: POLITICA_IDIOMA_COLOR,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al importar color";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
