import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { construirParejasLoteChusa } from "@/lib/pedido-proveedor/administrador-ic-monto";
import { loadAdministradorIcPp } from "@/lib/pedido-proveedor/administrador-ic-query";
import { generarFiDesdeAdministradorIc } from "@/lib/pedido-proveedor/administrador-ic-generar-fi";
import { borrarFiReservadasProgramado } from "@/lib/pedido-proveedor/proforma-programado-engine";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

type Params = { params: Promise<{ ppId: string }> };

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
  try {
    const body = (await req.json()) as { regenerar?: boolean };
    regenerar = body?.regenerar === true;
  } catch {
    /* body vacío = crear faltantes */
  }

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header) {
    return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
  }
  if (header.categoria_id !== CATEGORIA_PROGRAMADO_ID) {
    return NextResponse.json({ ok: false, error: "Solo PP PROGRAMADO" }, { status: 400 });
  }

  const { ics, prefacturas, chusa_modo_biblioteca } = await loadAdministradorIcPp(pool, ppId);
  const lote = construirParejasLoteChusa(ics, prefacturas, {
    modoBiblioteca: chusa_modo_biblioteca,
  });
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

  if (regenerar) {
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
  const nFiExistentes = fiExistRows[0]?.c ?? 0;

  if (!regenerar && nFiExistentes > nEsperadas) {
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

  if (!regenerar && nFiExistentes === nEsperadas) {
    return NextResponse.json({
      ok: true,
      already_done: true,
      total: nFiExistentes,
      n_esperadas: nEsperadas,
      generadas: [],
      avisos: [`Lote completo: ${nFiExistentes} FI = ${nEsperadas} IC.`],
    });
  }

  const generadas: Array<{
    ic_id: number;
    fi_id: number;
    fi_nro: string;
    total_pares: number;
    total_monto: number;
  }> = [];
  const avisos: string[] = regenerar
    ? [`Regeneración: ${nEsperadas} FI desde prefactura actual.`]
    : [];
  let omitidas = 0;

  for (const p of parejas) {
    if (!regenerar) {
      const { rows: fiIcRows } = await pool.query<{ c: number }>(
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
    });
    if (!result.ok) {
      console.error("[generar-fi-lote] fallo", p.ic_nro, p.ic_id, result.error, result.avisos?.slice(0, 3));
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Error en lote",
          fallo_ic_id: p.ic_id,
          fallo_ic_nro: p.ic_nro,
          avisos: result.avisos ?? [],
          generadas,
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

  return NextResponse.json({
    ok: true,
    regenerado: regenerar,
    total: regenerar ? generadas.length : nFiExistentes + generadas.length,
    generadas_en_lote: generadas.length,
    omitidas_ic_con_fi: omitidas,
    n_esperadas: nEsperadas,
    generadas,
    avisos,
  });
}
