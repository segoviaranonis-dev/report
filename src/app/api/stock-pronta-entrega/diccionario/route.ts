import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  PE_DICCIONARIO_FALLBACK,
  type PeDiccionarioCadenaRow,
} from "@/lib/pe/pe-diccionario";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    let entradas: PeDiccionarioCadenaRow[] = PE_DICCIONARIO_FALLBACK;

    try {
      const { rows } = await pool.query<PeDiccionarioCadenaRow>(
        `SELECT cadena_pe, descuento_d1_pct::float8 AS descuento_d1_pct,
                es_liquidacion, es_promo, excluir_catalogo, etiqueta_ui, notas
         FROM pe_diccionario_cadena ORDER BY cadena_pe`,
      );
      if (rows.length) entradas = rows;
    } catch {
      /* MIG-180 pendiente — fallback memoria */
    }

    let impacto: Array<{
      cadena_pe: string;
      descuento_d1_pct: number;
      etiqueta_ui: string | null;
      filas: string;
      moleculas: string;
      pares_saldo: string;
    }> = [];

    try {
      const imp = await pool.query(
        `SELECT cadena_pe, descuento_d1_pct::float8, etiqueta_ui, filas, moleculas, pares_saldo
         FROM v_pe_diccionario_impacto`,
      );
      impacto = imp.rows;
    } catch {
      const imp = await pool.query(
        `SELECT
           upper(btrim(COALESCE(am_cadena_comercial, 'REGULAR'))) AS cadena_pe,
           count(*)::bigint AS filas,
           sum(GREATEST(cantidad_pares - COALESCE(pares_vendidos,0),0))::bigint AS pares_saldo
         FROM pedido_proveedor_detalle ppd
         JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
         WHERE pp.entidad_comercial = 'STOCK' AND pp.deposito_codigo IS NOT NULL
         GROUP BY 1 ORDER BY 3 DESC`,
      );
      impacto = imp.rows.map((r) => ({
        ...r,
        descuento_d1_pct: entradas.find((e) => e.cadena_pe === r.cadena_pe)?.descuento_d1_pct ?? 4,
        etiqueta_ui: entradas.find((e) => e.cadena_pe === r.cadena_pe)?.etiqueta_ui ?? r.cadena_pe,
        moleculas: "0",
      }));
    }

    return NextResponse.json({
      ok: true,
      modulo: "diccionario-pronta-entrega",
      entradas,
      impacto,
      reglas: {
        motor_precios: "EXCLUIDO",
        descuento_d1: "REGULAR/COMUN 4% · PROMOCIONAL/LIQUIDACION 2%",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error diccionario PE" },
      { status: 500 },
    );
  }
}
