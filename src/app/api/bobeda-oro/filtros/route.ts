import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveBobedaAccess } from "@/lib/bobeda-oro/access";
import { loadBobedaFiltros } from "@/lib/bobeda-oro/queries";

export async function GET() {
  const session = await getSession();
  const access = resolveBobedaAccess(session);
  if (!access.ok) return access.error;

  try {
    const body = await loadBobedaFiltros(access.allowedClienteIds);
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error filtros bóveda";
    return NextResponse.json(
      { configured: true, tiendas: [], estados: [], origenes: [], marcas: [], vendedores: [], error: msg },
      { status: 500 },
    );
  }
}
