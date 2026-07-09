import { NextRequest, NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { resolverNombreEvento } from "@/lib/motor-precios/excel-proveedor";
import { ejecutarPaso0Carga } from "@/lib/motor-precios/evento-carga";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

const MAX_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "multipart/form-data requerido" }, { status: 400 });
  }

  const proveedorRaw = form.get("proveedor_id");
  const nombreEventoRaw = String(form.get("nombre_evento") ?? "").trim();
  const vigenteDesde = String(form.get("vigente_desde") ?? "").trim();
  const archivo = form.get("archivo");

  if (!proveedorRaw || !vigenteDesde) {
    return NextResponse.json({ ok: false, error: "proveedor_id y vigente_desde son obligatorios" }, { status: 400 });
  }

  if (!(archivo instanceof File)) {
    return NextResponse.json({ ok: false, error: "archivo Excel requerido" }, { status: 400 });
  }

  const nombreArchivo = archivo.name || "listado.xlsx";
  const nombreEvento = resolverNombreEvento(nombreEventoRaw, nombreArchivo);
  const ext = nombreArchivo.toLowerCase();
  if (!ext.endsWith(".xls") && !ext.endsWith(".xlsx")) {
    return NextResponse.json({ ok: false, error: "Solo .xls o .xlsx" }, { status: 400 });
  }

  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Archivo supera 200 MB" }, { status: 400 });
  }

  const proveedor_id = Number(proveedorRaw);
  if (!Number.isFinite(proveedor_id) || proveedor_id <= 0) {
    return NextResponse.json({ ok: false, error: "proveedor_id inválido" }, { status: 400 });
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());

  try {
    const result = await ejecutarPaso0Carga(getRimecPool(), {
      proveedor_id,
      nombre_evento: nombreEvento,
      vigente_desde: vigenteDesde,
      archivo: buffer,
      nombre_archivo: nombreArchivo,
      usuario_id: gate.session?.id_usuario ?? null,
    });

    if (!result.ok) {
      const status = result.code === "LEY_GENERO" ? 422 : result.code === "PROVEEDOR" ? 422 : 400;
      return NextResponse.json(result, { status });
    }

    const { skus: _skus, ...payload } = result;
    return NextResponse.json(payload);
  } catch (e) {
    return icApiErrorResponse(e, "Error en carga Paso 0");
  }
}
