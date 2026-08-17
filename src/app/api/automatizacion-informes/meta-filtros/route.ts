import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { mergePeAbcrTipo1Items } from "@/lib/filtros/pe-abcr-tipo1";
import { PE_TIPO_DICCIONARIO_OPCIONES } from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";

/**
 * GET · opciones de filtros para Control Pronta Entrega / automatizaciones.
 * Marcas y AB-CR desde stock PE vivo · **cascada por ramo/tipo_v2** (hermanos siameses).
 * Sin listados Motor (4.02.05.002 · precio = PPD AM).
 * Query: ?ramo=CALZADO|CONFECCIONES
 */
export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ramoRaw = String(req.nextUrl.searchParams.get("ramo") ?? "CALZADO")
    .trim()
    .toUpperCase();
  const ramo = ramoRaw === "CONFECCIONES" ? "CONFECCIONES" : "CALZADO";
  /** tipo_v2_id: 1 calzado · 2 confecciones (paridad vista PE). */
  const tipoV2 = ramo === "CONFECCIONES" ? 2 : 1;

  const pool = getRimecPool();
  try {
    const marcasQ = await pool.query<{ marca: string; n: string }>(
      `
      SELECT upper(trim(coalesce(nullif(descp_marca, ''), sdrm_marca, ''))) AS marca,
             count(*)::text AS n
      FROM v_stock_pe_rimec
      WHERE coalesce(saldo_pares, 0) > 0
        AND trim(coalesce(nullif(descp_marca, ''), sdrm_marca, '')) <> ''
        AND (
          tipo_v2_id = $1
          OR upper(trim(coalesce(ramo_tipo, ''))) = $2
        )
      GROUP BY 1
      ORDER BY count(*) DESC, 1
      LIMIT 200
      `,
      [tipoV2, ramo],
    );

    const abcrQ = await pool.query<{ id: string; label: string }>(
      `
      SELECT DISTINCT
        coalesce(tipo_1_id, 0)::text AS id,
        upper(trim(coalesce(descp_tipo_1, sdrm_tipo1, ''))) AS label
      FROM v_stock_pe_rimec
      WHERE coalesce(saldo_pares, 0) > 0
        AND trim(coalesce(descp_tipo_1, sdrm_tipo1, '')) <> ''
        AND (
          tipo_v2_id = $1
          OR upper(trim(coalesce(ramo_tipo, ''))) = $2
        )
      LIMIT 500
      `,
      [tipoV2, ramo],
    );

    const abcrMerged = mergePeAbcrTipo1Items(
      abcrQ.rows
        .filter((r) => r.label)
        .map((r) => ({ id: Number(r.id) || 0, label: r.label })),
    );

    return NextResponse.json({
      ok: true,
      ramo,
      tipo_v2_id: tipoV2,
      tipos_dpe: PE_TIPO_DICCIONARIO_OPCIONES.map((o) => ({
        id: o.id,
        label: o.label,
        ramos: o.ramos,
      })),
      marcas: marcasQ.rows.map((r) => ({ label: r.marca, n: Number(r.n) })),
      abcr: abcrMerged.map((a) => ({ id: a.id, label: a.label })),
      depositos: ["D1", "DEP2", "D3"],
      reglas_pdf: {
        pdf_por_marca_caso: true,
        segregar_lpn_lpc03: true,
        precio: "PPD Alejandro Magno",
        nota: "Sin listados Motor · LPN/LPC desde PPD",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error meta filtros";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
