import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { construirParejasLoteChusa } from "@/lib/pedido-proveedor/administrador-ic-monto";
import { loadAdministradorIcPp } from "@/lib/pedido-proveedor/administrador-ic-query";
import { generarFiDesdeAdministradorIc } from "@/lib/pedido-proveedor/administrador-ic-generar-fi";
import { borrarFiReservadasProgramado } from "@/lib/pedido-proveedor/proforma-programado-engine";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { tryLockPpFiOpsWithStaleRecovery, unlockPpFiOps } from "@/lib/pedido-proveedor/pp-fi-advisory-lock";

type Params = { params: Promise<{ ppId: string }> };

/** Lote Admin IC — batches cortos; 1 sola conexión por request (Vercel pool max=1). */
export const maxDuration = 120;

const FI_LOTE_BATCH_DEFAULT = 12;
const FI_LOTE_BATCH_MAX = 20;

/** Protocolo Chusa · genera N FI en secuencia (1 IC ↔ 1 PF por pareja). */
export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  let regenerar = false;
  let offset = 0;
  let batchSize = FI_LOTE_BATCH_DEFAULT;
  try {
    const body = (await req.json()) as {
      regenerar?: boolean;
      offset?: number;
      batch_size?: number;
    };
    regenerar = body?.regenerar === true;
    offset = Math.max(0, Number(body?.offset ?? 0));
    const bs = Number(body?.batch_size ?? FI_LOTE_BATCH_DEFAULT);
    if (Number.isFinite(bs) && bs > 0) {
      batchSize = Math.min(FI_LOTE_BATCH_MAX, Math.max(1, Math.floor(bs)));
    }
  } catch {
    /* body vacío = crear faltantes desde offset 0 */
  }

  const pool = getRimecPool();

  try {
    const header = await getPpDetalle(pool, ppId);
    if (!header) {
      return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
    }
    if (header.categoria_id !== CATEGORIA_PROGRAMADO_ID) {
      return NextResponse.json({ ok: false, error: "Solo PP PROGRAMADO" }, { status: 400 });
    }

    const { ics, prefacturas } = await loadAdministradorIcPp(pool, ppId);
    const lote = construirParejasLoteChusa(ics, prefacturas);
    if (!lote.ok) {
      return NextResponse.json(
        { ok: false, error: lote.error, chusa: lote.chusa },
        { status: 400 },
      );
    }

    const parejas = lote.parejas;
    if (!parejas.length) {
      return NextResponse.json({ ok: false, error: "Sin parejas IC↔PF para lote." }, { status: 400 });
    }

    const nEsperadas = parejas.length;

    if (regenerar && offset === 0) {
      const del = await borrarFiReservadasProgramado(ppId);
      if (!del.ok) {
        return NextResponse.json(
          { ok: false, error: del.error ?? "No se pudieron borrar FI RESERVADA para regenerar." },
          { status: 409 },
        );
      }
    }

    const { rows: fiExistRows } = await pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1",
      [ppId],
    );
    let nFiExistentes = fiExistRows[0]?.c ?? 0;

    if (!regenerar && offset === 0 && nFiExistentes > nEsperadas) {
      return NextResponse.json(
        {
          ok: false,
          fi_exceso: true,
          n_fi: nFiExistentes,
          n_esperadas: nEsperadas,
          error: `Hay ${nFiExistentes - nEsperadas} FI de más (${nFiExistentes} vs ${nEsperadas} IC). Revisá tab Facturas Internas antes de continuar.`,
        },
        { status: 409 },
      );
    }

    if (!regenerar && offset === 0 && nFiExistentes === nEsperadas) {
      return NextResponse.json({
        ok: true,
        done: true,
        already_done: true,
        total: nFiExistentes,
        n_esperadas: nEsperadas,
        next_offset: null,
        generadas_en_lote: 0,
        generadas: [],
        avisos: [`Lote completo: ${nFiExistentes} FI = ${nEsperadas} IC.`],
      });
    }

    if (offset < nFiExistentes) offset = nFiExistentes;

    if (offset >= nEsperadas) {
      return NextResponse.json({
        ok: true,
        done: true,
        total: nFiExistentes,
        n_esperadas: nEsperadas,
        next_offset: null,
        generadas_en_lote: 0,
        generadas: [],
        avisos: [`Lote completo: ${nFiExistentes} FI = ${nEsperadas} IC.`],
      });
    }

    const batch = parejas.slice(offset, offset + batchSize);
    const client = await pool.connect();
    let ppFiLocked = false;
    try {
      if (!(await tryLockPpFiOpsWithStaleRecovery(client, ppId))) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Hay otro proceso FI en este PP (cambio de biblioteca u otro lote) — esperá unos segundos y reintentá.",
          },
          { status: 409 },
        );
      }
      ppFiLocked = true;

      const generadas: Array<{
        ic_id: number;
        fi_id: number;
        fi_nro: string;
        total_pares: number;
        total_monto: number;
      }> = [];
      const avisos: string[] =
        regenerar && offset === 0
          ? [`Regeneración por lotes: ${nEsperadas} FI desde prefactura.`]
          : [];
      let omitidas = 0;

      for (const p of batch) {
        if (!regenerar && p.ppd_ids.length > 0) {
          const { rows: fiPpdRows } = await client.query<{ c: number }>(
            `SELECT COUNT(*)::int AS c
             FROM factura_interna_detalle fid
             JOIN factura_interna fi ON fi.id = fid.factura_id
             WHERE fi.pp_id = $1 AND fid.ppd_id = ANY($2::int[])`,
            [ppId, p.ppd_ids],
          );
          if ((fiPpdRows[0]?.c ?? 0) > 0) {
            omitidas++;
            continue;
          }
        } else if (!regenerar) {
          const { rows: fiIcRows } = await client.query<{ c: number }>(
            `SELECT COUNT(*)::int AS c
             FROM factura_interna fi
             JOIN intencion_compra ic ON TRIM(fi.notas) = TRIM(ic.numero_registro)
             WHERE fi.pp_id = $1 AND ic.id = $2`,
            [ppId, p.ic_id],
          );
          if ((fiIcRows[0]?.c ?? 0) > 0) {
            omitidas++;
            continue;
          }
        }

        const result = await generarFiDesdeAdministradorIc(pool, ppId, p.ic_id, p.ppd_ids, {
          ppd_pares: p.ppd_pares,
          txClient: client,
        });
        if (!result.ok) {
          console.error(
            "[generar-fi-lote] fallo",
            p.ic_nro,
            p.ic_id,
            result.error,
            result.avisos?.slice(0, 3),
          );
          return NextResponse.json(
            {
              ok: false,
              error: result.error ?? "Error en lote",
              fallo_ic_id: p.ic_id,
              fallo_ic_nro: p.ic_nro,
              avisos: result.avisos ?? [],
              generadas,
              offset,
              n_esperadas: nEsperadas,
            },
            { status: 400 },
          );
        }
        if (result.avisos?.length) avisos.push(...result.avisos);
        generadas.push({
          ic_id: p.ic_id,
          fi_id: result.fi_id!,
          fi_nro: result.fi_nro!,
          total_pares: result.total_pares!,
          total_monto: result.total_monto!,
        });
      }

      const { rows: fiAfterRows } = await client.query<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1",
        [ppId],
      );
      nFiExistentes = fiAfterRows[0]?.c ?? nFiExistentes + generadas.length;
      const nextOffset = offset + batch.length;
      const done = nextOffset >= nEsperadas;

      return NextResponse.json({
        ok: true,
        done,
        regenerado: regenerar && offset === 0,
        total: nFiExistentes,
        generadas_en_lote: generadas.length,
        omitidas_ic_con_fi: omitidas,
        n_esperadas: nEsperadas,
        offset,
        next_offset: done ? null : nextOffset,
        generadas,
        avisos,
      });
    } finally {
      if (ppFiLocked) {
        await unlockPpFiOps(client, ppId).catch(() => undefined);
      }
      client.release();
    }
  } catch (e) {
    return icApiErrorResponse(e, "Error al generar lote FI");
  }
}
