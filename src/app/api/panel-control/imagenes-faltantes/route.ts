import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  auditImagenesFaltantes,
  type MoleculaImagenInput,
} from "@/lib/retail/product-image-presence";

const MAX_ITEMS = 2500;

/**
 * POST /api/panel-control/imagenes-faltantes
 * Protocolo automático PE/AM — conteo fichas sin JPG en Storage (stem FK 654|638).
 * Objetivo: respuesta útil en cabecera &lt;1s (caché + HEAD paralelo sm/flat).
 */
export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const raw = (body as { items?: unknown })?.items;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "items[] requerido" }, { status: 400 });
  }
  if (raw.length > MAX_ITEMS) {
    return NextResponse.json(
      { ok: false, error: `Máximo ${MAX_ITEMS} moléculas por request` },
      { status: 400 },
    );
  }

  const items: MoleculaImagenInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const linea = String(r.linea ?? "").trim();
    if (!linea) continue;
    items.push({
      linea,
      referencia: String(r.referencia ?? "").trim(),
      material: String(r.material ?? "").trim(),
      color: String(r.color ?? "").trim(),
      tipo_v2_id:
        r.tipo_v2_id == null || r.tipo_v2_id === ""
          ? null
          : Number(r.tipo_v2_id),
      imagen_nombre:
        r.imagen_nombre == null ? null : String(r.imagen_nombre).trim() || null,
      imagen_color_excel:
        r.imagen_color_excel == null
          ? null
          : String(r.imagen_color_excel).trim() || null,
    });
  }

  try {
    const audit = await auditImagenesFaltantes(items);
    return NextResponse.json({
      ok: true,
      total: audit.total,
      sinImagen: audit.sinImagen,
      ms: audit.ms,
      sinImagen654: audit.sinImagen654,
      sinImagen638: audit.sinImagen638,
      total654: audit.total654,
      total638: audit.total638,
      faltantes: audit.faltantesMolKeys,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error auditoría imagen" },
      { status: 500 },
    );
  }
}
