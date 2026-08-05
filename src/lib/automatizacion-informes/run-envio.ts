import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Pool } from "pg";
import { depositarMensajeAutomatizacion } from "@/lib/mensajes-internos/queries";
import { generarPdfStockPeParticion } from "./generar-pdf-stock-pe";
import { generarPdfStockPe638Particion } from "./generar-pdf-stock-pe-638";
import {
  fetchParticionStockPePorGrupo,
  listGruposDpeConStock,
  LPS_ORDEN,
  pathArchivoGrupoDpe,
} from "./query-particion-pe";
import { enviarAvisoInforme, smtpDisponible } from "./mailer-servicio";

export type RunEnvioResult = {
  ok: boolean;
  automatizacion_id: number;
  pdfs: { filename: string; totalPares: number; estilos: number; bytes: number }[];
  mensaje_id: number | null;
  mail: { ok: boolean; canal: string; to: string; path?: string; error?: string }[];
  error?: string;
};

type AutoRow = {
  id: number;
  nombre: string;
  ramo: string | null;
  marcas: string[];
  depositos: string[];
  tipos_dpe: string[];
  abcr_labels: string[];
};

type DestRow = { usuario_id: number; email: string; nombre: string };

export async function ejecutarAutomatizacionEnvio(
  pool: Pool,
  automatizacionId: number,
  opts?: {
    maxPdfs?: number;
    createdByUsuarioId?: number | null;
    /** prep = PDF+bandeja sin mail · aviso = solo email · full = ambos */
    fase?: "prep" | "aviso" | "full";
    /** Para fase aviso: resumen ya generado en prep */
    prep?: { mensaje_id: number; pdfs: RunEnvioResult["pdfs"]; asunto?: string };
  },
): Promise<RunEnvioResult> {
  const fase = opts?.fase ?? "full";
  const maxPdfs =
    opts?.maxPdfs ??
    Number(process.env.PE_PDF_MAX || 500);

  if (fase === "aviso") {
    return enviarSoloAviso(pool, automatizacionId, opts?.prep);
  }
  const autoQ = await pool.query<AutoRow>(
    `
    SELECT id, nombre, ramo, marcas, depositos, tipos_dpe, abcr_labels
    FROM informe_automatizacion_envio
    WHERE id = $1 AND activo = true
    `,
    [automatizacionId],
  );
  const auto = autoQ.rows[0];
  if (!auto) {
    return {
      ok: false,
      automatizacion_id: automatizacionId,
      pdfs: [],
      mensaje_id: null,
      mail: [],
      error: "Automatización no encontrada o inactiva",
    };
  }

  const destQ = await pool.query<DestRow>(
    `
    SELECT d.usuario_id, d.email, d.nombre
    FROM informe_automatizacion_destinatario d
    WHERE d.automatizacion_id = $1 AND d.activo = true AND d.usuario_id IS NOT NULL
    `,
    [automatizacionId],
  );
  if (!destQ.rows.length) {
    return {
      ok: false,
      automatizacion_id: automatizacionId,
      pdfs: [],
      mensaje_id: null,
      mail: [],
      error: "Sin destinatarios",
    };
  }

  let marcas = (auto.marcas ?? []).map((m) => m.trim().toUpperCase()).filter(Boolean);
  if (!marcas.length) {
    const top = await pool.query<{ m: string }>(
      `
      SELECT upper(trim(coalesce(nullif(descp_marca, ''), sdrm_marca, ''))) AS m
      FROM v_stock_pe_rimec
      WHERE coalesce(saldo_pares, 0) > 0
        AND upper(trim(coalesce(nullif(descp_marca, ''), sdrm_marca, ''))) LIKE 'MOLECA%'
      GROUP BY 1 ORDER BY sum(saldo_pares) DESC NULLS LAST LIMIT 1
      `,
    );
    if (top.rows[0]?.m) marcas = [top.rows[0].m];
  }

  const ramoRaw = String(auto.ramo ?? "CALZADO").trim().toUpperCase();
  const ramoPdf =
    ramoRaw === "CONFECCIONES"
      ? ("CONFECCIONES" as const)
      : ramoRaw === "ACCESORIOS"
        ? ("ACCESORIOS" as const)
        : ("CALZADO" as const);

  const storageDir = resolve(process.cwd(), ".tmp", "pdf-automatizacion", String(automatizacionId));
  mkdirSync(storageDir, { recursive: true });
  for (const lp of LPS_ORDEN) {
    mkdirSync(resolve(storageDir, ramoPdf, lp), { recursive: true });
  }

  const pdfsMeta: RunEnvioResult["pdfs"] = [];
  const adjuntos: {
    nombre_archivo: string;
    storage_path: string;
    bytes: number;
    buffer?: Buffer;
    total_pares: number;
  }[] = [];
  const guardarBufferMail =
    fase !== "prep" && process.env.SMTP_ADJUNTA_PDF === "1";

  /** Ley DPE: 1 COD.GRUPO = 1 PDF · carpeta LP · marca. */
  outer: for (const marca of marcas) {
    for (const lp of LPS_ORDEN) {
      const planes = await listGruposDpeConStock(pool, {
        marca,
        listaPrecio: lp,
        depositos: auto.depositos?.length ? auto.depositos : undefined,
      });
      console.log(`[run-envio] ${marca} ${lp}: ${planes.length} grupos DPE`);
      for (const plan of planes) {
        if (pdfsMeta.length >= maxPdfs) break outer;
        const particion = await fetchParticionStockPePorGrupo(pool, {
          marca,
          listaPrecio: lp,
          codGrupo: plan.codGrupo,
          cadena: plan.cadena,
          casoLabel: plan.label,
          depositos: auto.depositos?.length ? auto.depositos : undefined,
          limit: Number(process.env.PE_PDF_ROW_LIMIT || 800),
        });
        if (!particion) continue;
        try {
          const paths = pathArchivoGrupoDpe(marca, lp, plan, ramoPdf);
          const payload = {
            ...particion,
            casoLabel: plan.label,
            cadenaComercial: plan.cadena,
            particionId: `G${plan.codGrupo}`,
          };
          // 638 confecciones: pivot precio · tallas (≠ layout grada 654)
          const gen =
            ramoPdf === "CONFECCIONES"
              ? await generarPdfStockPe638Particion(payload)
              : await generarPdfStockPeParticion(payload);
          const storage_path = resolve(storageDir, paths.relDir, paths.filename);
          writeFileSync(storage_path, gen.buffer);
          pdfsMeta.push({
            filename: paths.relPath,
            totalPares: gen.totalPares,
            estilos: gen.estilos,
            bytes: gen.buffer.length,
          });
          adjuntos.push({
            nombre_archivo: paths.relPath,
            storage_path,
            bytes: gen.buffer.length,
            total_pares: gen.totalPares,
            ...(guardarBufferMail ? { buffer: gen.buffer } : {}),
          });
          const unidad = ramoPdf === "CONFECCIONES" ? "prendas" : "pares";
          console.log(
            `[run-envio] OK ${paths.relPath} · ${gen.totalPares} ${unidad} · #${pdfsMeta.length}`,
          );
        } catch (e) {
          console.warn(
            "[run-envio] skip PDF",
            marca,
            plan.label,
            lp,
            e instanceof Error ? e.message : e,
          );
        }
      }
    }
  }

  if (!adjuntos.length) {
    return {
      ok: false,
      automatizacion_id: automatizacionId,
      pdfs: [],
      mensaje_id: null,
      mail: [],
      error: "Ningún PDF generado (sin stock en particiones)",
    };
  }

  const usuarioIds = destQ.rows.map((d) => Number(d.usuario_id));
  const porLp = LPS_ORDEN.map(
    (lp) => `${lp}: ${pdfsMeta.filter((p) => p.filename.startsWith(`${lp}/`)).length} archivos`,
  ).join(" · ");
  const asunto = `[PE] ${auto.nombre} · ${pdfsMeta.length} PDF (1 COD.GRUPO = 1 PDF)`;
  const cuerpo = `Stock Pronta Entrega · DPE.\nLey: 1 COD.GRUPO = 1 PDF.\nCarpetas: ${porLp}\nArchivos:\n${pdfsMeta.map((p) => `· ${p.filename}`).join("\n")}\nAbrí Mensajes internos → Stock pronta entrega.`;

  const mensaje_id = await depositarMensajeAutomatizacion(pool, {
    carpetaCodigo: "STOCK_PRONTA_ENTREGA",
    automatizacionId,
    asunto,
    cuerpo,
    usuarioIds,
    adjuntos: adjuntos.map((a) => ({
      nombre_archivo: a.nombre_archivo,
      storage_path: a.storage_path,
      bytes: a.bytes,
      total_pares: a.total_pares,
    })),
    createdByUsuarioId: opts?.createdByUsuarioId ?? null,
  });

  // Fase prep: PDF listos en bandeja; el mail sale a la hora exacta (T).
  if (fase === "prep") {
    return {
      ok: true,
      automatizacion_id: automatizacionId,
      pdfs: pdfsMeta,
      mensaje_id,
      mail: [],
    };
  }

  const mail = await dispararAvisosMail(destQ.rows, asunto, pdfsMeta, adjuntos);

  return {
    ok: true,
    automatizacion_id: automatizacionId,
    pdfs: pdfsMeta,
    mensaje_id,
    mail,
  };
}

async function enviarSoloAviso(
  pool: Pool,
  automatizacionId: number,
  prep?: { mensaje_id: number; pdfs: RunEnvioResult["pdfs"]; asunto?: string },
): Promise<RunEnvioResult> {
  const autoQ = await pool.query<{ nombre: string }>(
    `SELECT nombre FROM informe_automatizacion_envio WHERE id = $1 AND activo`,
    [automatizacionId],
  );
  if (!autoQ.rows[0]) {
    return {
      ok: false,
      automatizacion_id: automatizacionId,
      pdfs: [],
      mensaje_id: null,
      mail: [],
      error: "Automatización no encontrada",
    };
  }
  const destQ = await pool.query<DestRow>(
    `
    SELECT d.usuario_id, d.email, d.nombre
    FROM informe_automatizacion_destinatario d
    WHERE d.automatizacion_id = $1 AND d.activo = true
    `,
    [automatizacionId],
  );
  const pdfs = prep?.pdfs ?? [];
  const asunto =
    prep?.asunto ??
    `[PE] ${autoQ.rows[0].nombre} · ${pdfs.length || "?"} PDF listos`;
  const mail = await dispararAvisosMail(destQ.rows, asunto, pdfs, []);
  return {
    ok: mail.some((m) => m.ok) || mail.length === 0,
    automatizacion_id: automatizacionId,
    pdfs,
    mensaje_id: prep?.mensaje_id ?? null,
    mail,
  };
}

async function dispararAvisosMail(
  dests: DestRow[],
  asunto: string,
  pdfsMeta: RunEnvioResult["pdfs"],
  adjuntos: { nombre_archivo: string; buffer?: Buffer }[],
): Promise<RunEnvioResult["mail"]> {
  const html = `<p>Stock Pronta Entrega — <b>${pdfsMeta.length}</b> PDF listos en Report → Mensajes internos.</p>
<ul>${pdfsMeta.map((p) => `<li>${p.filename} · ${p.totalPares} pares · ${p.estilos} estilos</li>`).join("")}</ul>
<p>No hace falta vaciar tu casilla: el stock está en la bandeja Nexus.</p>
<p><a href="http://localhost:3000/mensajes-internos">Abrir bandeja Stock PE</a></p>`;

  const adjuntosMail =
    process.env.SMTP_ADJUNTA_PDF === "1"
      ? adjuntos
          .filter((a): a is { nombre_archivo: string; buffer: Buffer } => !!a.buffer)
          .map((a) => ({
            filename: a.nombre_archivo,
            content: a.buffer,
            contentType: "application/pdf" as const,
          }))
      : undefined;

  const mail: RunEnvioResult["mail"] = [];
  for (const d of dests) {
    const r = await enviarAvisoInforme({
      to: d.email,
      subject: asunto,
      html,
      attachments: adjuntosMail,
      forzarSmtp: true,
    });
    mail.push({
      ok: r.ok,
      canal: r.canal,
      to: r.to,
      path: r.path,
      error: r.error,
    });
  }
  return mail;
}

export function infoSmtpLocal() {
  return { smtp: smtpDisponible() };
}
