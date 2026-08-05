import type { Pool } from "pg";
import { ejecutarAutomatizacionEnvio, type RunEnvioResult } from "./run-envio";
import { ahoraAsuncion, minutosPrepPdf, restarMinutos } from "./reloj";

export type TickResult = {
  checked: number;
  prep: number;
  mail: number;
  skipped: number;
  errors: string[];
  ahora: string;
  /** alias compat logs */
  fired: number;
};

type AutoRow = {
  id: number;
  nombre: string;
  horarios: string[];
  dias_semana: number[];
};

function normTime(t: unknown): string {
  const s = String(t ?? "");
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

async function claimSlot(
  pool: Pool,
  autoId: number,
  slotKey: string,
  horario: string,
): Promise<boolean> {
  const claim = await pool.query(
    `
    INSERT INTO informe_automatizacion_tick (automatizacion_id, slot_key, horario, ok)
    VALUES ($1, $2, $3::time, true)
    ON CONFLICT (automatizacion_id, slot_key) DO NOTHING
    RETURNING slot_key
    `,
    [autoId, slotKey, horario],
  );
  return (claim.rowCount ?? 0) > 0;
}

/**
 * Reloj:
 * - T-10 min (AUTO_PREP_MINUTES): genera PDF + deposita bandeja (anti-timeout fotos)
 * - T (hora exacta): envía email de aviso (PDFs ya listos)
 */
export async function tickRelojAutomatizaciones(pool: Pool): Promise<TickResult> {
  const ahora = ahoraAsuncion();
  const prepMins = minutosPrepPdf();
  const errors: string[] = [];
  let prep = 0;
  let mail = 0;
  let skipped = 0;

  const autos = await pool.query<AutoRow>(
    `
    SELECT id, nombre,
           COALESCE(horarios, '{}')::text[] AS horarios,
           COALESCE(dias_semana, '{1,2,3,4,5,6,7}')::int[] AS dias_semana
    FROM informe_automatizacion_envio
    WHERE activo = true
    `,
  );

  for (const auto of autos.rows) {
    if (!auto.dias_semana?.includes(ahora.diaIso)) {
      skipped += 1;
      continue;
    }
    const horas = (auto.horarios ?? []).map(normTime).filter(Boolean);
    for (const hEnvio of horas) {
      const hPrep = restarMinutos(hEnvio, prepMins);

      // —— PREP T-10 ——
      if (ahora.horaMin === hPrep) {
        const slot = `${ahora.fecha}T${hEnvio}:prep`;
        if (!(await claimSlot(pool, auto.id, slot, hEnvio))) {
          skipped += 1;
        } else {
          try {
            console.log(
              `[reloj] PREP #${auto.id} ${auto.nombre} · envío ${hEnvio} · arranque ${hPrep} (−${prepMins}m)`,
            );
            const r = await ejecutarAutomatizacionEnvio(pool, auto.id, {
              maxPdfs: Number(process.env.PE_PDF_MAX || 24),
              fase: "prep",
            });
            const detalle = r.ok
              ? JSON.stringify({
                  fase: "prep",
                  mensaje_id: r.mensaje_id,
                  pdfs: r.pdfs,
                  asunto: `[PE] ${auto.nombre} · ${r.pdfs.length} PDF`,
                }).slice(0, 2000)
              : (r.error ?? "fail").slice(0, 500);
            await pool.query(
              `UPDATE informe_automatizacion_tick SET ok = $3, detalle = $4
               WHERE automatizacion_id = $1 AND slot_key = $2`,
              [auto.id, slot, r.ok, detalle],
            );
            if (r.ok) prep += 1;
            else errors.push(`prep #${auto.id}: ${r.error}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "error";
            errors.push(`prep #${auto.id}: ${msg}`);
            await pool.query(
              `UPDATE informe_automatizacion_tick SET ok = false, detalle = $3
               WHERE automatizacion_id = $1 AND slot_key = $2`,
              [auto.id, slot, msg.slice(0, 500)],
            );
          }
        }
      }

      // —— MAIL a la hora exacta ——
      if (ahora.horaMin === hEnvio) {
        const slotMail = `${ahora.fecha}T${hEnvio}:mail`;
        if (!(await claimSlot(pool, auto.id, slotMail, hEnvio))) {
          skipped += 1;
          continue;
        }
        try {
          const prepSlot = `${ahora.fecha}T${hEnvio}:prep`;
          const prepRow = await pool.query<{ ok: boolean; detalle: string | null }>(
            `SELECT ok, detalle FROM informe_automatizacion_tick
             WHERE automatizacion_id = $1 AND slot_key = $2`,
            [auto.id, prepSlot],
          );
          let prepData: {
            mensaje_id: number;
            pdfs: RunEnvioResult["pdfs"];
            asunto?: string;
          } | undefined;
          if (prepRow.rows[0]?.ok && prepRow.rows[0].detalle) {
            try {
              const j = JSON.parse(prepRow.rows[0].detalle) as {
                mensaje_id?: number;
                pdfs?: RunEnvioResult["pdfs"];
                asunto?: string;
              };
              if (j.mensaje_id && j.pdfs) {
                prepData = {
                  mensaje_id: j.mensaje_id,
                  pdfs: j.pdfs,
                  asunto: j.asunto,
                };
              }
            } catch {
              /* */
            }
          }

          let r: RunEnvioResult;
          if (prepData) {
            console.log(`[reloj] MAIL #${auto.id} aviso (prep OK msg=${prepData.mensaje_id})`);
            r = await ejecutarAutomatizacionEnvio(pool, auto.id, {
              fase: "aviso",
              prep: prepData,
            });
          } else {
            // Fallback: si no hubo prep, genera full ahora (mejor tarde que vacío)
            console.warn(`[reloj] MAIL #${auto.id} sin prep — full de emergencia`);
            r = await ejecutarAutomatizacionEnvio(pool, auto.id, {
              maxPdfs: Number(process.env.PE_PDF_MAX || 24),
              fase: "full",
            });
          }

          await pool.query(
            `UPDATE informe_automatizacion_tick SET ok = $3, detalle = $4
             WHERE automatizacion_id = $1 AND slot_key = $2`,
            [
              auto.id,
              slotMail,
              r.ok,
              r.ok
                ? `mail;msg=${r.mensaje_id};canal=${r.mail[0]?.canal ?? "?"}`
                : (r.error ?? "fail").slice(0, 500),
            ],
          );
          if (r.ok) mail += 1;
          else errors.push(`mail #${auto.id}: ${r.error ?? "fail"}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          errors.push(`mail #${auto.id}: ${msg}`);
          await pool.query(
            `UPDATE informe_automatizacion_tick SET ok = false, detalle = $3
             WHERE automatizacion_id = $1 AND slot_key = $2`,
            [auto.id, slotMail, msg.slice(0, 500)],
          );
        }
      }
    }
  }

  return {
    checked: autos.rows.length,
    prep,
    mail,
    skipped,
    errors,
    ahora: `${ahora.fecha} ${ahora.horaMin} dia=${ahora.diaIso} prep−${prepMins}m`,
    fired: prep + mail,
  };
}
