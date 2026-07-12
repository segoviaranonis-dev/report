/**
 * Audita caso prefactura vs señales motor (STYLE CARTERAS · material BAG) en todos PP PROGRAMADO.
 * Uso: npx tsx scripts/audit_caso_prefactura_programado.ts [--json]
 */
import fs from "fs";
import pg from "pg";
import { loadAdministradorIcPp } from "../src/lib/pedido-proveedor/administrador-ic-query";
import { evalProtocoloChusa } from "../src/lib/pedido-proveedor/administrador-ic-monto";
import { getRimecPool } from "../src/lib/rimec/pool";
import {
  loadCasosEventoNombres,
  resolveCasoMotorPrecios,
  casoLineaFromMapa,
} from "../src/lib/pedido-proveedor/resolve-caso-comercial";
import { loadMapaCasoPorLineaEvento } from "../src/lib/motor-precios/caso-linea-evento";

const jsonOut = process.argv.includes("--json");

type Alerta = {
  pp_id: number;
  nro_pp: string;
  shop: number;
  linea: string;
  referencia: string;
  material: string;
  caso_resuelto: string;
  caso_pl: string;
  caso_pele: string;
  motivo: string;
};

function senalCartera(material: string): boolean {
  const m = String(material ?? "").toUpperCase();
  return /\bBAG\b|CARTER|BOLSA|BOLSO|\bSTR\s+B\b/.test(m);
}

async function main() {
  const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  const pool = url ? new pg.Pool({ connectionString: url }) : getRimecPool();

  const { rows: pps } = await pool.query<{ id: number; numero_registro: string }>(
    `SELECT pp.id::int, pp.numero_registro
     FROM pedido_proveedor pp
     WHERE pp.categoria_id = 3
     ORDER BY pp.id`,
  );

  const resumen: Array<{
    pp_id: number;
    nro_pp: string;
    evento_id: number | null;
    n_ic: number;
    n_pf: number;
    chusa_n1: boolean;
    alertas_cartera: number;
    alertas_sin_caso: number;
    ok: boolean;
  }> = [];

  const alertas: Alerta[] = [];

  for (const pp of pps) {
    let payload;
    try {
      payload = await loadAdministradorIcPp(pool, pp.id);
    } catch (e) {
      resumen.push({
        pp_id: pp.id,
        nro_pp: pp.numero_registro,
        evento_id: null,
        n_ic: 0,
        n_pf: 0,
        chusa_n1: false,
        alertas_cartera: 0,
        alertas_sin_caso: 0,
        ok: false,
      });
      console.error(`PP-${pp.id} ERROR:`, e instanceof Error ? e.message : e);
      continue;
    }

    const chusa = evalProtocoloChusa(payload.ics, payload.prefacturas, payload.ics);
    let alertasCartera = 0;
    let alertasSinCaso = 0;

    const ev = await pool.query<{ evento_id: number | null }>(
      `SELECT icp.precio_evento_id::int AS evento_id
       FROM intencion_compra_pedido icp
       WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
       LIMIT 1`,
      [pp.id],
    );
    const eventoId = ev.rows[0]?.evento_id ?? null;
    const mapaPele = eventoId ? await loadMapaCasoPorLineaEvento(pool, eventoId) : new Map();
    const casosEvento = eventoId ? await loadCasosEventoNombres(pool, eventoId) : new Set<string>();

    for (const pf of payload.prefacturas) {
      for (const art of pf.articulos) {
        if (!art.caso || art.caso === "—") {
          alertasSinCaso++;
          alertas.push({
            pp_id: pp.id,
            nro_pp: pp.numero_registro,
            shop: pf.id_cliente,
            linea: art.linea,
            referencia: art.referencia,
            material: art.material,
            caso_resuelto: art.caso ?? "—",
            caso_pl: "",
            caso_pele: casoLineaFromMapa(mapaPele, art.linea),
            motivo: "sin_caso",
          });
          continue;
        }

        const pele = casoLineaFromMapa(mapaPele, art.linea);
        const esCarteraSenal =
          senalCartera(art.material) ||
          normCaso(art.caso) === "CARTERAS" ||
          normCaso(pele) === "CARTERAS";

        if (esCarteraSenal && normCaso(art.caso) !== "CARTERAS" && senalCartera(art.material)) {
          alertasCartera++;
          alertas.push({
            pp_id: pp.id,
            nro_pp: pp.numero_registro,
            shop: pf.id_cliente,
            linea: art.linea,
            referencia: art.referencia,
            material: art.material,
            caso_resuelto: art.caso,
            caso_pl: "",
            caso_pele: pele,
            motivo: "material_cartera_no_caso_carteras",
          });
        }
      }
    }

    // Segunda pasada: filas con estilo CARTERAS en BD pero caso != CARTERAS
    if (eventoId) {
      const { rows: estiloRows } = await pool.query<{
        shop: string;
        linea: string;
        referencia: string;
        material: string;
        estilo_lr: string;
        caso_pl: string;
        pares: number;
      }>(
        `SELECT COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '0') AS shop,
                TRIM(ppd.linea) AS linea,
                TRIM(ppd.referencia) AS referencia,
                COALESCE(ppd.descp_material, '') AS material,
                COALESCE(ge.descp_grupo_estilo, lr.descp_grupo_estilo, '') AS estilo_lr,
                COALESCE(NULLIF(TRIM(pl.nombre_caso_aplicado), ''), '—') AS caso_pl,
                SUM(ppd.cantidad_pares)::int AS pares
         FROM pedido_proveedor_detalle ppd
         JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
         LEFT JOIN linea l ON l.id = ppd.linea_id
         LEFT JOIN linea l_cod ON l_cod.proveedor_id = pp.proveedor_importacion_id
           AND l_cod.codigo_proveedor::text = TRIM(ppd.linea) AND l.id IS NULL
         LEFT JOIN linea l_eff ON l_eff.id = COALESCE(l.id, l_cod.id)
         LEFT JOIN referencia ref ON ref.id = ppd.referencia_id
         LEFT JOIN referencia ref_cod ON ref_cod.linea_id = l_eff.id
           AND ref_cod.codigo_proveedor::text = TRIM(COALESCE(ppd.referencia, '0')) AND ref.id IS NULL
         LEFT JOIN referencia ref_eff ON ref_eff.id = COALESCE(ref.id, ref_cod.id)
         LEFT JOIN linea_referencia lr ON lr.linea_id = l_eff.id AND lr.referencia_id = ref_eff.id
         LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
         LEFT JOIN material m ON m.id = ppd.id_material
         LEFT JOIN material m_cod ON m_cod.proveedor_id = pp.proveedor_importacion_id
           AND m_cod.codigo_proveedor::text = ppd.material_code AND m.id IS NULL
         LEFT JOIN material m_eff ON m_eff.id = COALESCE(m.id, m_cod.id)
         LEFT JOIN precio_lista pl ON pl.evento_id = $2 AND pl.linea_id = l_eff.id
           AND pl.referencia_id = ref_eff.id AND pl.material_id = m_eff.id
         WHERE ppd.pedido_proveedor_id = $1
           AND ppd.linea IS NOT NULL AND TRIM(ppd.linea) <> ''
         GROUP BY 1,2,3,4,5,6`,
        [pp.id, eventoId],
      );

      for (const r of estiloRows) {
        const estNorm = normCaso(r.estilo_lr);
        if (estNorm !== "CARTERAS") continue;
        const casoCalc = resolveCasoMotorPrecios({
          casoPl: r.caso_pl,
          casoPele: casoLineaFromMapa(mapaPele, r.linea),
          estiloLr: r.estilo_lr,
          estiloLinea: "",
          materialHint: r.material,
          casosEvento,
        });
        if (normCaso(casoCalc) !== "CARTERAS") {
          alertasCartera++;
          alertas.push({
            pp_id: pp.id,
            nro_pp: pp.numero_registro,
            shop: Number(r.shop) || 0,
            linea: r.linea,
            referencia: r.referencia,
            material: r.material,
            caso_resuelto: casoCalc,
            caso_pl: r.caso_pl,
            caso_pele: casoLineaFromMapa(mapaPele, r.linea),
            motivo: "estilo_carteras_resuelto_otro",
          });
        }
      }
    }

    const ok = chusa.nivel1 && alertasCartera === 0 && alertasSinCaso === 0;
    resumen.push({
      pp_id: pp.id,
      nro_pp: pp.numero_registro,
      evento_id: eventoId,
      n_ic: chusa.contadorIc,
      n_pf: chusa.contadorPf,
      chusa_n1: chusa.nivel1,
      alertas_cartera: alertasCartera,
      alertas_sin_caso: alertasSinCaso,
      ok,
    });
  }

  if (jsonOut) {
    console.log(JSON.stringify({ resumen, alertas }, null, 2));
  } else {
    console.log("\n=== RESUMEN PP PROGRAMADO — caso prefactura ===\n");
    console.table(resumen);
    const graves = resumen.filter((r) => !r.ok);
    console.log(`\nPP con posible error: ${graves.length} / ${resumen.length}`);
    if (alertas.length) {
      console.log("\n=== ALERTAS (muestra max 40) ===\n");
      console.table(alertas.slice(0, 40));
      if (alertas.length > 40) console.log(`… +${alertas.length - 40} alertas más`);
    } else {
      console.log("\nSin alertas cartera/sin_caso en motor actual.");
    }
  }

  await pool.end();
}

function normCaso(s: string): string {
  return String(s ?? "")
    .replace(/\*/g, "")
    .trim()
    .toUpperCase();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
