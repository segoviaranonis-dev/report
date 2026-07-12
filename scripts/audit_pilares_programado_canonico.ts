/**
 * Auditoría retroactiva pilares × biblioteca × motor — todos PP PROGRAMADO (categoria_id=3).
 * Protocolo: provision proforma (L·R·LR·M·C·tono) + FK PPD + BCL/PELE.
 *
 * Uso:
 *   npx tsx scripts/audit_pilares_programado_canonico.ts
 *   npx tsx scripts/audit_pilares_programado_canonico.ts --json
 *   npx tsx scripts/audit_pilares_programado_canonico.ts --pp 28 30
 */
import fs from "fs";
import pg from "pg";

const jsonOut = process.argv.includes("--json");
const ppFilter = (() => {
  const i = process.argv.indexOf("--pp");
  if (i < 0) return null;
  return process.argv
    .slice(i + 1)
    .map(Number)
    .filter(Number.isFinite);
})();

type PpAuditRow = {
  pp_id: number;
  numero_registro: string;
  numero_proforma: string | null;
  quincena: string | null;
  estado: string | null;
  proveedor_id: number;
  n_ppd: number;
  n_moleculas: number;
  pares: number;
  n_ic: number;
  evento_id: number | null;
  evento_nombre: string | null;
  biblioteca_id: number | null;
  biblioteca_nombre: string | null;
  n_proforma_snapshot: number;
  /** FK PPD */
  ppd_sin_linea_id: number;
  ppd_sin_referencia_id: number;
  ppd_sin_material_id: number;
  ppd_sin_color_id: number;
  ppd_mol_completa: number;
  /** Pilares canónicos (moléculas únicas) */
  mol_sin_linea_pilar: number;
  mol_sin_referencia_pilar: number;
  mol_sin_lr_pilar: number;
  mol_sin_material_pilar: number;
  mol_sin_color_pilar: number;
  mol_color_sin_tono: number;
  mol_mat_ciego: number;
  linea_sin_marca: number;
  linea_sin_genero: number;
  /** Motor */
  lineas_unicas: number;
  lineas_sin_bcl: number;
  lineas_sin_pele: number;
  /** Operativo */
  ppd_shop_cero: number;
  ppd_sin_shop_key: number;
  estado_pilares: "OK" | "WARN" | "FAIL" | "SIN_STOCK";
  estado_motor: "OK" | "WARN" | "SIN_EVENTO" | "SIN_STOCK";
  codigos_sin_bcl: string[];
  codigos_sin_pilar: string[];
};

async function main() {
  const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("DATABASE_URL missing in .env.local");
  const pool = new pg.Pool({ connectionString: url });

  const ppWhere =
    ppFilter?.length ? `pp.id = ANY($1::int[])` : `pp.categoria_id = 3`;

  const ppParams = ppFilter?.length ? [ppFilter] : [];

  const { rows: pps } = await pool.query<{
    id: number;
    numero_registro: string;
    numero_proforma: string | null;
    quincena: string | null;
    estado: string | null;
    proveedor_id: number;
  }>(
    `
    SELECT pp.id::int,
           pp.numero_registro,
           pp.numero_proforma,
           qa.descripcion AS quincena,
           pp.estado_transito AS estado,
           COALESCE(pp.proveedor_importacion_id, 654)::int AS proveedor_id
    FROM pedido_proveedor pp
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE ${ppWhere}
    ORDER BY pp.quincena_arribo_id NULLS LAST, pp.id
    `,
    ppParams,
  );

  const resultados: PpAuditRow[] = [];

  for (const pp of pps) {
    const ppId = pp.id;
    const provId = pp.proveedor_id;

    const meta = await pool.query<{
      n_ppd: number;
      n_moleculas: number;
      pares: number;
      n_ic: number;
      evento_id: number | null;
      evento_nombre: string | null;
      biblioteca_id: number | null;
      biblioteca_nombre: string | null;
      n_proforma_snapshot: number;
      ppd_sin_linea_id: number;
      ppd_sin_referencia_id: number;
      ppd_sin_material_id: number;
      ppd_sin_color_id: number;
      ppd_mol_completa: number;
      ppd_shop_cero: number;
      ppd_sin_shop_key: number;
    }>(
      `
      WITH ev AS (
        SELECT icp.precio_evento_id::int AS evento_id
        FROM intencion_compra_pedido icp
        WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
        ORDER BY icp.id LIMIT 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = $1) AS n_ppd,
        (SELECT COUNT(DISTINCT (TRIM(d.linea), TRIM(d.referencia), TRIM(d.material_code), TRIM(d.color_code)))::int
         FROM pedido_proveedor_detalle d
         WHERE d.pedido_proveedor_id = $1 AND d.linea IS NOT NULL AND TRIM(d.linea) <> '') AS n_moleculas,
        (SELECT COALESCE(SUM(d.cantidad_pares), 0)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = $1) AS pares,
        (SELECT COUNT(DISTINCT icp.intencion_compra_id)::int FROM intencion_compra_pedido icp WHERE icp.pedido_proveedor_id = $1) AS n_ic,
        ev.evento_id,
        (SELECT pe.nombre_evento FROM precio_evento pe WHERE pe.id = ev.evento_id) AS evento_nombre,
        (SELECT bp.id::int FROM precio_evento pe JOIN biblioteca_precio bp ON bp.id = pe.biblioteca_precio_id WHERE pe.id = ev.evento_id) AS biblioteca_id,
        (SELECT bp.nombre FROM precio_evento pe JOIN biblioteca_precio bp ON bp.id = pe.biblioteca_precio_id WHERE pe.id = ev.evento_id) AS biblioteca_nombre,
        (SELECT CASE WHEN pf.filas IS NOT NULL THEN jsonb_array_length(pf.filas) ELSE 0 END::int
         FROM pp_proforma_filas pf WHERE pf.pp_id = $1 LIMIT 1) AS n_proforma_snapshot,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = $1 AND d.linea_id IS NULL) AS ppd_sin_linea_id,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = $1 AND d.referencia_id IS NULL) AS ppd_sin_referencia_id,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = $1 AND d.id_material IS NULL) AS ppd_sin_material_id,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = $1 AND d.id_color IS NULL) AS ppd_sin_color_id,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d
         WHERE d.pedido_proveedor_id = $1 AND d.linea_id IS NOT NULL AND d.referencia_id IS NOT NULL AND d.id_material IS NOT NULL) AS ppd_mol_completa,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d
         WHERE d.pedido_proveedor_id = $1 AND COALESCE(NULLIF(TRIM(d.grades_json->>'_shop'), ''), '0') = '0') AS ppd_shop_cero,
        (SELECT COUNT(*)::int FROM pedido_proveedor_detalle d
         WHERE d.pedido_proveedor_id = $1 AND (d.grades_json IS NULL OR d.grades_json->>'_shop' IS NULL)) AS ppd_sin_shop_key
      FROM ev
      `,
      [ppId],
    );

    const m = meta.rows[0];
    if (!m || m.n_ppd === 0) {
      resultados.push({
        pp_id: ppId,
        numero_registro: pp.numero_registro,
        numero_proforma: pp.numero_proforma,
        quincena: pp.quincena,
        estado: pp.estado,
        proveedor_id: provId,
        n_ppd: 0,
        n_moleculas: 0,
        pares: 0,
        n_ic: m?.n_ic ?? 0,
        evento_id: m?.evento_id ?? null,
        evento_nombre: m?.evento_nombre ?? null,
        biblioteca_id: m?.biblioteca_id ?? null,
        biblioteca_nombre: m?.biblioteca_nombre ?? null,
        n_proforma_snapshot: m?.n_proforma_snapshot ?? 0,
        ppd_sin_linea_id: 0,
        ppd_sin_referencia_id: 0,
        ppd_sin_material_id: 0,
        ppd_sin_color_id: 0,
        ppd_mol_completa: 0,
        mol_sin_linea_pilar: 0,
        mol_sin_referencia_pilar: 0,
        mol_sin_lr_pilar: 0,
        mol_sin_material_pilar: 0,
        mol_sin_color_pilar: 0,
        mol_color_sin_tono: 0,
        mol_mat_ciego: 0,
        linea_sin_marca: 0,
        linea_sin_genero: 0,
        lineas_unicas: 0,
        lineas_sin_bcl: 0,
        lineas_sin_pele: 0,
        ppd_shop_cero: 0,
        ppd_sin_shop_key: 0,
        estado_pilares: "SIN_STOCK",
        estado_motor: "SIN_STOCK",
        codigos_sin_bcl: [],
        codigos_sin_pilar: [],
      });
      continue;
    }

    const pilares = await pool.query<{
      mol_sin_linea_pilar: number;
      mol_sin_referencia_pilar: number;
      mol_sin_lr_pilar: number;
      mol_sin_material_pilar: number;
      mol_sin_color_pilar: number;
      mol_color_sin_tono: number;
      mol_mat_ciego: number;
      linea_sin_marca: number;
      linea_sin_genero: number;
    }>(
      `
      WITH mol AS (
        SELECT DISTINCT
          TRIM(ppd.linea) AS linea,
          TRIM(COALESCE(ppd.referencia, '0')) AS referencia,
          TRIM(COALESCE(ppd.material_code, '')) AS material_code,
          TRIM(COALESCE(ppd.color_code, '')) AS color_code,
          MAX(ppd.descp_material) AS descp_material
        FROM pedido_proveedor_detalle ppd
        WHERE ppd.pedido_proveedor_id = $1
          AND ppd.linea IS NOT NULL AND TRIM(ppd.linea) <> ''
        GROUP BY 1, 2, 3, 4
      ),
      j AS (
        SELECT m.*,
               l.id AS linea_id, l.marca_id, l.genero_id,
               ref.id AS referencia_id,
               lr.linea_id AS lr_ok,
               mat.id AS material_id, mat.descripcion AS mat_desc,
               col.id AS color_id, col.tono_canon
        FROM mol m
        LEFT JOIN linea l ON l.proveedor_id = $2 AND l.codigo_proveedor::text = m.linea
        LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = m.referencia
        LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = ref.id AND lr.proveedor_id = $2
        LEFT JOIN material mat ON mat.proveedor_id = $2 AND mat.codigo_proveedor::text = m.material_code
        LEFT JOIN color col ON col.proveedor_id = $2 AND col.codigo_proveedor::text = m.color_code
      )
      SELECT
        COUNT(*) FILTER (WHERE linea_id IS NULL)::int AS mol_sin_linea_pilar,
        COUNT(*) FILTER (WHERE linea_id IS NOT NULL AND referencia_id IS NULL)::int AS mol_sin_referencia_pilar,
        COUNT(*) FILTER (WHERE referencia_id IS NOT NULL AND lr_ok IS NULL)::int AS mol_sin_lr_pilar,
        COUNT(*) FILTER (WHERE material_code <> '' AND material_id IS NULL)::int AS mol_sin_material_pilar,
        COUNT(*) FILTER (WHERE color_code <> '' AND color_id IS NULL)::int AS mol_sin_color_pilar,
        COUNT(*) FILTER (WHERE color_id IS NOT NULL AND (tono_canon IS NULL OR btrim(tono_canon->>'etiqueta') = ''))::int AS mol_color_sin_tono,
        COUNT(*) FILTER (WHERE material_id IS NOT NULL AND material_code <> '' AND COALESCE(btrim(mat_desc), '') = '')::int AS mol_mat_ciego,
        COUNT(DISTINCT linea) FILTER (WHERE linea_id IS NOT NULL AND marca_id IS NULL)::int AS linea_sin_marca,
        COUNT(DISTINCT linea) FILTER (WHERE linea_id IS NOT NULL AND genero_id IS NULL)::int AS linea_sin_genero
      FROM j
      `,
      [ppId, provId],
    );

    const p = pilares.rows[0]!;

    const lineasQ = await pool.query<{ linea: string }>(
      `
      SELECT DISTINCT TRIM(ppd.linea) AS linea
      FROM pedido_proveedor_detalle ppd
      WHERE ppd.pedido_proveedor_id = $1 AND ppd.linea IS NOT NULL AND TRIM(ppd.linea) <> ''
      `,
      [ppId],
    );
    const lineas = lineasQ.rows
      .map((r) => String(Math.trunc(Number(r.linea))))
      .sort((a, b) => Number(a) - Number(b));

    let lineas_sin_bcl: string[] = [];
    let lineas_sin_pele: string[] = [];
    const bibId = m.biblioteca_id;
    const eventoId = m.evento_id;

    if (bibId && lineas.length) {
      const bcl = await pool.query<{ linea: string }>(
        `
        SELECT t.linea
        FROM unnest($1::text[]) AS t(linea)
        INNER JOIN linea l ON l.proveedor_id = $2 AND l.codigo_proveedor::text = t.linea
        WHERE NOT EXISTS (
          SELECT 1 FROM biblioteca_caso_linea bcl
          WHERE bcl.biblioteca_id = $3 AND bcl.linea_id = l.id
        )
        ORDER BY t.linea::bigint
        `,
        [lineas, provId, bibId],
      );
      lineas_sin_bcl = bcl.rows.map((r) => r.linea);
    }

    if (eventoId && lineas.length) {
      const pele = await pool.query<{ linea: string }>(
        `
        SELECT t.linea
        FROM unnest($1::text[]) AS t(linea)
        INNER JOIN linea l ON l.proveedor_id = $2 AND l.codigo_proveedor::text = t.linea
        WHERE NOT EXISTS (
          SELECT 1 FROM precio_evento_linea_excepcion pele
          JOIN precio_evento_caso pec ON pec.id = pele.caso_id
          WHERE pec.evento_id = $3 AND pele.linea_id = l.id
        )
        ORDER BY t.linea::bigint
        `,
        [lineas, provId, eventoId],
      );
      lineas_sin_pele = pele.rows.map((r) => r.linea);
    }

    const sinPilar = await pool.query<{ linea: string }>(
      `
      SELECT DISTINCT TRIM(ppd.linea) AS linea
      FROM pedido_proveedor_detalle ppd
      LEFT JOIN linea l ON l.proveedor_id = $2 AND l.codigo_proveedor::text = TRIM(ppd.linea)
      WHERE ppd.pedido_proveedor_id = $1 AND ppd.linea IS NOT NULL AND TRIM(ppd.linea) <> ''
        AND l.id IS NULL
      `,
      [ppId, provId],
    );

    const pilaresFail =
      m.ppd_sin_linea_id > 0 ||
      m.ppd_sin_referencia_id > 0 ||
      p.mol_sin_linea_pilar > 0 ||
      p.mol_sin_referencia_pilar > 0 ||
      p.mol_sin_lr_pilar > 0 ||
      p.mol_sin_material_pilar > 0;

    const pilaresWarn =
      m.ppd_sin_material_id > 0 ||
      m.ppd_sin_color_id > 0 ||
      p.mol_sin_color_pilar > 0 ||
      p.mol_color_sin_tono > 0 ||
      p.linea_sin_marca > 0;

    let estado_pilares: PpAuditRow["estado_pilares"] = "OK";
    if (pilaresFail) estado_pilares = "FAIL";
    else if (pilaresWarn) estado_pilares = "WARN";

    let estado_motor: PpAuditRow["estado_motor"] = "OK";
    if (!eventoId) estado_motor = "SIN_EVENTO";
    else if (lineas_sin_bcl.length > 0 || lineas_sin_pele.length > 0) estado_motor = "WARN";

    resultados.push({
      pp_id: ppId,
      numero_registro: pp.numero_registro,
      numero_proforma: pp.numero_proforma,
      quincena: pp.quincena,
      estado: pp.estado,
      proveedor_id: provId,
      n_ppd: m.n_ppd,
      n_moleculas: m.n_moleculas,
      pares: m.pares,
      n_ic: m.n_ic,
      evento_id: eventoId,
      evento_nombre: m.evento_nombre,
      biblioteca_id: bibId,
      biblioteca_nombre: m.biblioteca_nombre,
      n_proforma_snapshot: m.n_proforma_snapshot,
      ppd_sin_linea_id: m.ppd_sin_linea_id,
      ppd_sin_referencia_id: m.ppd_sin_referencia_id,
      ppd_sin_material_id: m.ppd_sin_material_id,
      ppd_sin_color_id: m.ppd_sin_color_id,
      ppd_mol_completa: m.ppd_mol_completa,
      mol_sin_linea_pilar: p.mol_sin_linea_pilar,
      mol_sin_referencia_pilar: p.mol_sin_referencia_pilar,
      mol_sin_lr_pilar: p.mol_sin_lr_pilar,
      mol_sin_material_pilar: p.mol_sin_material_pilar,
      mol_sin_color_pilar: p.mol_sin_color_pilar,
      mol_color_sin_tono: p.mol_color_sin_tono,
      mol_mat_ciego: p.mol_mat_ciego,
      linea_sin_marca: p.linea_sin_marca,
      linea_sin_genero: p.linea_sin_genero,
      lineas_unicas: lineas.length,
      lineas_sin_bcl: lineas_sin_bcl.length,
      lineas_sin_pele: lineas_sin_pele.length,
      ppd_shop_cero: m.ppd_shop_cero,
      ppd_sin_shop_key: m.ppd_sin_shop_key,
      estado_pilares,
      estado_motor,
      codigos_sin_bcl: lineas_sin_bcl.slice(0, 20),
      codigos_sin_pilar: sinPilar.rows.map((r) => r.linea).slice(0, 20),
    });
  }

  const tot = {
    n_pp: resultados.length,
    con_stock: resultados.filter((r) => r.n_ppd > 0).length,
    sin_stock: resultados.filter((r) => r.n_ppd === 0).length,
    pilares_ok: resultados.filter((r) => r.estado_pilares === "OK").length,
    pilares_warn: resultados.filter((r) => r.estado_pilares === "WARN").length,
    pilares_fail: resultados.filter((r) => r.estado_pilares === "FAIL").length,
    motor_warn: resultados.filter((r) => r.estado_motor === "WARN").length,
    shop_cero: resultados.filter((r) => r.ppd_shop_cero > 0).length,
  };

  if (jsonOut) {
    console.log(JSON.stringify({ totales: tot, pps: resultados }, null, 2));
  } else {
    console.log("=== AUDITORÍA PILARES CANÓNICOS — PP PROGRAMADO (categoria_id=3) ===\n");
    console.log("Totales:", tot);
    console.log("\n--- Por PP (resumen) ---");
    console.table(
      resultados.map((r) => ({
        id: r.pp_id,
        nro: r.numero_registro,
        proforma: r.numero_proforma ?? "—",
        ppd: r.n_ppd,
        mol: r.n_moleculas,
        pilares: r.estado_pilares,
        motor: r.estado_motor,
        sin_lr_fk: r.ppd_sin_linea_id + r.ppd_sin_referencia_id,
        sin_pilar: r.mol_sin_linea_pilar + r.mol_sin_referencia_pilar + r.mol_sin_lr_pilar,
        sin_bcl: r.lineas_sin_bcl,
        sin_pele: r.lineas_sin_pele,
        shop0: r.ppd_shop_cero,
        bib: r.biblioteca_nombre ?? "—",
      })),
    );

    const fails = resultados.filter((r) => r.estado_pilares === "FAIL" || r.estado_motor === "WARN");
    if (fails.length) {
      console.log("\n--- Detalle FAIL / motor WARN ---");
      for (const r of fails) {
        console.log(`\n${r.numero_registro} (id ${r.pp_id}) · ${r.numero_proforma ?? "sin proforma"}`);
        console.log(
          `  PPD FK: L=${r.ppd_sin_linea_id} R=${r.ppd_sin_referencia_id} M=${r.ppd_sin_material_id} C=${r.ppd_sin_color_id}`,
        );
        console.log(
          `  Pilar mol: sin_L=${r.mol_sin_linea_pilar} sin_R=${r.mol_sin_referencia_pilar} sin_LR=${r.mol_sin_lr_pilar} sin_M=${r.mol_sin_material_pilar}`,
        );
        if (r.codigos_sin_pilar.length) console.log(`  Líneas sin pilar: ${r.codigos_sin_pilar.join(", ")}`);
        if (r.codigos_sin_bcl.length)
          console.log(`  Sin BCL (${r.lineas_sin_bcl}): ${r.codigos_sin_bcl.join(", ")}${r.lineas_sin_bcl > 20 ? "…" : ""}`);
        if (r.lineas_sin_pele) console.log(`  Sin PELE: ${r.lineas_sin_pele} línea(s)`);
        if (r.ppd_shop_cero) console.log(`  _shop=0: ${r.ppd_shop_cero} filas PPD`);
      }
    }

    console.log("\n--- Reparación sugerida (solo FK/pilares faltantes) ---");
    console.log("  npx tsx scripts/repair_pp_programado_pilares_fk.ts [--audit-only]");
    console.log("  npx tsx scripts/backfill_pp_pilares_from_ppd.ts [ppId...]");
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
