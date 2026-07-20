import { NextResponse } from "next/server";
import {
  groupLogisticaPorCadenaCliente,
  groupLogisticaPorVendedorCadenaCliente,
  listLogisticaPendientes,
} from "@/lib/logistica-ok/queries-bandeja";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const vendedorRaw = url.searchParams.get("vendedor_id");
  const vendedorId = vendedorRaw != null && vendedorRaw !== "" ? Number(vendedorRaw) : null;
  const vista = url.searchParams.get("vista");
  const estado = url.searchParams.get("estado") === "TODOS" ? "TODOS" : "PENDIENTE";

  try {
    const filas = await listLogisticaPendientes(getRimecPool(), {
      vendedorId: vista === "vendedor" && vendedorId != null && Number.isFinite(vendedorId) ? vendedorId : null,
      estado,
    });
    const cajas = filas.reduce((s, f) => s + f.cajas, 0);
    const stats = { n: filas.length, cajas };
    if (vista === "vendedor") {
      const gruposVendedor = groupLogisticaPorVendedorCadenaCliente(filas);
      return NextResponse.json({ ok: true, filas, gruposVendedor, stats });
    }
    const grupos = groupLogisticaPorCadenaCliente(filas);
    return NextResponse.json({ ok: true, filas, grupos, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
