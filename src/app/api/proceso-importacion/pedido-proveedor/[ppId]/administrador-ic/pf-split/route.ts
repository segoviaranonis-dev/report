import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  createPfSplit,
} from "@/lib/pedido-proveedor/admin-ic-pf-splits";
import { icParPrefactura, parejaTripleteIcPf } from "@/lib/pedido-proveedor/administrador-ic-monto";
import { loadAdministradorIcPp } from "@/lib/pedido-proveedor/administrador-ic-query";
import { splitIcParesEnPp } from "@/lib/pedido-proveedor/cabecera-actions";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

type Params = { params: Promise<{ ppId: string }> };

/** Divide prefactura · pares parciales · opcional sync IC (Chusa). */
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

  let body: {
    parent_pf_key?: string;
    pares?: number;
    id_cliente?: number;
    sync_ic?: boolean;
    articulos?: { ppd_id: number; pares: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parentPfKey = String(body.parent_pf_key ?? "").trim();
  const idCliente = Number(body.id_cliente);
  const syncIc = body.sync_ic !== false;
  const articulosBody = Array.isArray(body.articulos)
    ? body.articulos
        .map((a) => ({ ppd_id: Number(a.ppd_id), pares: Math.round(Number(a.pares)) }))
        .filter((a) => Number.isFinite(a.ppd_id) && Number.isFinite(a.pares) && a.pares > 0)
    : undefined;
  const paresBody = body.pares != null ? Number(body.pares) : undefined;

  if (!parentPfKey) {
    return NextResponse.json({ ok: false, error: "parent_pf_key obligatorio." }, { status: 400 });
  }
  if (!articulosBody?.length && (!Number.isFinite(paresBody!) || paresBody! <= 0)) {
    return NextResponse.json(
      { ok: false, error: "Seleccioná artículos o indicá pares a separar." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(idCliente) || idCliente <= 0) {
    return NextResponse.json({ ok: false, error: "id_cliente destino obligatorio." }, { status: 400 });
  }

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header) {
    return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
  }
  if (header.categoria_id !== CATEGORIA_PROGRAMADO_ID) {
    return NextResponse.json({ ok: false, error: "Solo PP PROGRAMADO" }, { status: 400 });
  }

  const basePayload = await loadAdministradorIcPp(pool, ppId);

  const parentPf = basePayload.prefacturas.find((p) => p.pf_key === parentPfKey);
  if (!parentPf) {
    return NextResponse.json({ ok: false, error: "Prefactura origen no encontrada." }, { status: 404 });
  }

  const splitRes = await createPfSplit(pool, ppId, basePayload.prefacturas, {
    parent_pf_key: parentPfKey,
    id_cliente: idCliente,
    ...(articulosBody?.length ? { articulos: articulosBody } : { pares: paresBody }),
  });
  if (!splitRes.ok) {
    return NextResponse.json({ ok: false, error: splitRes.error }, { status: 400 });
  }

  const paresSplit = splitRes.split.pares;

  let icSync: { ic_nueva_id?: number; nro_ic_nueva?: string } | null = null;
  if (syncIc) {
    const icMatch = basePayload.ics.find(
      (ic) =>
        icParPrefactura(ic, parentPf) &&
        parejaTripleteIcPf(ic, { ...parentPf, total_pares: parentPf.total_pares }),
    );
    if (icMatch) {
      const icSplit = await splitIcParesEnPp(pool, ppId, icMatch.ic_id, paresSplit, idCliente);
      if (icSplit.ok) {
        icSync = { ic_nueva_id: icSplit.ic_nueva_id, nro_ic_nueva: icSplit.nro_ic_nueva };
      }
    }
  }

  const data = await loadAdministradorIcPp(pool, ppId);
  return NextResponse.json({
    ok: true,
    split: splitRes.split,
    ic_sync: icSync,
    ...data,
  });
}
