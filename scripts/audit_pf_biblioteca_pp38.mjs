/**
 * Auditoría: ¿PF Admin IC reconstruidas con biblioteca cabecera PP?
 * Uso: npx tsx scripts/audit_pf_biblioteca_pp38.mjs
 */
import fs from "fs";
import pg from "pg";
import { loadAdministradorIcPp } from "../src/lib/pedido-proveedor/administrador-ic-query.js";
import { loadPpCasoContext } from "../src/lib/pedido-proveedor/pp-caso-context.js";
import { normAdminEtiqueta } from "../src/lib/pedido-proveedor/administrador-ic-monto.js";

const ppId = Number(process.argv[2] ?? 38);
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });

const pp = await pool.query(
  `SELECT pp.id, pp.numero_registro, pp.biblioteca_precio_id::int AS bib_id, bp.nombre AS bib_nombre,
          (SELECT COUNT(*)::int FROM factura_interna WHERE pp_id = pp.id) AS n_fi,
          COALESCE(pp.admin_ic_pf_splits::text, '[]') AS splits
   FROM pedido_proveedor pp
   LEFT JOIN biblioteca_precio bp ON bp.id = pp.biblioteca_precio_id
   WHERE pp.id = $1`,
  [ppId],
);

const bibId = pp.rows[0]?.bib_id;
const casosMayo = await pool.query(
  `SELECT cpb.nombre_caso,
          COUNT(bcl.linea_id)::int AS lineas_bcl
   FROM caso_precio_biblioteca cpb
   LEFT JOIN biblioteca_caso_linea bcl ON bcl.caso_biblioteca_id = cpb.id
   WHERE cpb.biblioteca_id = $1 AND cpb.activo
   GROUP BY cpb.id, cpb.nombre_caso ORDER BY cpb.nombre_caso`,
  [bibId],
);

const evento = await pool.query(
  `SELECT DISTINCT icp.precio_evento_id::int AS evento_id, pe.nombre_evento,
          pe.biblioteca_precio_id::int AS bib_evento
   FROM intencion_compra_pedido icp
   JOIN precio_evento pe ON pe.id = icp.precio_evento_id
   WHERE icp.pedido_proveedor_id = $1`,
  [ppId],
);

const payload = await loadAdministradorIcPp(pool, ppId);
const casoCtx = await loadPpCasoContext(pool, ppId);
const casosPf = [...new Set(payload.prefacturas.map((p) => p.caso))].sort();
const casosBib = casosMayo.rows.map((r) => r.nombre_caso);

const eventoId = evento.rows[0]?.evento_id ?? null;
const mapaEvento =
  eventoId && casoCtx.fuente !== "biblioteca"
    ? await loadMapaCasoPorLineaEvento(pool, eventoId)
    : new Map();
const mapaMayo = casoCtx.mapaCasoLinea;

const ppdLineas = await pool.query(
  `SELECT DISTINCT TRIM(ppd.linea) AS linea,
          COALESCE(ppd.cantidad_pares,0)::int AS pares
   FROM pedido_proveedor_detalle ppd
   WHERE ppd.pedido_proveedor_id = $1 AND ppd.linea IS NOT NULL`,
  [ppId],
);

let diffEventoVsMayo = 0;
let soloMayo = 0;
let soloEvento = 0;
const ejemplosDiff = [];
for (const [linea, casoMayo] of mapaMayo) {
  const casoEv = mapaEvento.get(linea);
  if (casoEv && normAdminEtiqueta(casoEv) !== normAdminEtiqueta(casoMayo)) {
    diffEventoVsMayo++;
    if (ejemplosDiff.length < 5) ejemplosDiff.push({ linea, evento: casoEv, mayo: casoMayo });
  }
  if (!casoEv) soloMayo++;
}
for (const [linea] of mapaEvento) {
  if (!mapaMayo.has(linea)) soloEvento++;
}

const paresPpd = ppdLineas.rows.reduce((a, r) => a + Number(r.pares), 0);
const paresPf = payload.prefacturas.reduce((a, p) => a + p.total_pares, 0);
const paresIc = payload.ics.reduce((a, i) => a + i.pares, 0);

const casosEnPpdMayo = await pool.query(
  `
  WITH ppd AS (
    SELECT DISTINCT TRIM(ppd.linea) AS linea_codigo
    FROM pedido_proveedor_detalle ppd
    WHERE ppd.pedido_proveedor_id = $2 AND TRIM(ppd.linea) <> ''
  ),
  bcl AS (
    SELECT cpb.nombre_caso, l.codigo_proveedor::text AS linea_codigo
    FROM biblioteca_caso_linea bcl
    JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
    JOIN linea l ON l.id = bcl.linea_id
    WHERE bcl.biblioteca_id = $1 AND cpb.activo
  )
  SELECT b.nombre_caso, COUNT(*)::int AS lineas_en_ppd
  FROM bcl b JOIN ppd p ON p.linea_codigo = b.linea_codigo
  GROUP BY b.nombre_caso ORDER BY b.nombre_caso
  `,
  [bibId, ppId],
);

const casosBibEnPpd = casosEnPpdMayo.rows.map((r) => r.nombre_caso);
const casosPfFaltanEnBibPpd = casosPf.filter(
  (c) => c !== "—" && !casosBibEnPpd.includes(c) && casosBib.includes(c),
);
const casosBibPpdNoEnPf = casosBibEnPpd.filter((c) => !casosPf.includes(c));

const veredicto = {
  cabecera_biblioteca_mayo: bibId === 9,
  pf_virtuales_recalculadas_cada_carga: true,
  fi_borradas_splits_reset: Number(pp.rows[0]?.n_fi ?? 0) === 0 && pp.rows[0]?.splits === "[]",
  motor_caso_usa_bcl_mayo: casoCtx.fuente === "biblioteca",
  motor_caso_usa_pele_evento_ic: casoCtx.fuente === "evento",
  fuente_caso: casoCtx.fuente,
  casos_pf_vs_bib_mayo_en_ppd: {
    casos_biblioteca_mayo: casosBib,
    casos_presentes_en_ppd_segun_bcl_mayo: casosBibEnPpd,
    casos_en_pf_hoy: casosPf,
    casos_bcl_ppd_ausentes_en_pf: casosBibPpdNoEnPf,
  },
  reconstruccion_completa_biblioteca_mayo: false,
  motivo: "",
};

if (!veredicto.cabecera_biblioteca_mayo) {
  veredicto.motivo = "Cabecera PP no apunta a BIBLIOTECA MAYO 2026.";
} else if (!veredicto.fi_borradas_splits_reset) {
  veredicto.motivo = "Quedan FI o splits — cambio biblioteca incompleto.";
} else if (casoCtx.fuente !== "biblioteca") {
  veredicto.motivo =
    `Motor caso en «${casoCtx.fuente}» — se esperaba biblioteca BCL #${bibId}.`;
} else if (casosBibPpdNoEnPf.length) {
  veredicto.motivo = `BCL Mayo activo pero faltan casos en PF: ${casosBibPpdNoEnPf.join(", ")}.`;
} else {
  veredicto.reconstruccion_completa_biblioteca_mayo = casosBibPpdNoEnPf.length === 0;
  veredicto.motor_caso_usa_bcl_mayo = true;
  veredicto.motivo = veredicto.reconstruccion_completa_biblioteca_mayo
    ? "Cabecera Mayo + casos PF cubren todos los casos BCL con líneas en PPD."
    : `Faltan casos en PF: ${casosBibPpdNoEnPf.join(", ")}`;
}

console.log(
  JSON.stringify(
    {
      pp: pp.rows[0],
      evento_ic: evento.rows,
      conteos: { n_ic: payload.ics.length, n_pf: payload.prefacturas.length, pares_ic: paresIc, pares_pf: paresPf, pares_ppd: paresPpd },
      casos_mayo_biblioteca: casosMayo.rows,
      mapa_caso: {
        lineas_pele_evento: mapaEvento.size,
        lineas_bcl_mayo: mapaMayo.size,
        lineas_con_caso_distinto_evento_vs_mayo: diffEventoVsMayo,
        ejemplos_diff: ejemplosDiff,
      },
      veredicto,
    },
    null,
    2,
  ),
);

await pool.end();
