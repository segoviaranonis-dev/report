import { createReadStream, existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getSession } from "@/lib/auth/session";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
type Ctx = { params: Promise<{ adjuntoId: string }> };

/** GET · descarga PDF adjunto (solo si sos destinatario) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base no configurada" }, { status: 503 });
  }

  const adjuntoId = Number((await ctx.params).adjuntoId);
  if (!Number.isFinite(adjuntoId) || adjuntoId <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const r = await pool.query<{
    nombre_archivo: string;
    storage_path: string | null;
    mime: string;
  }>(
    `
      SELECT a.nombre_archivo, a.storage_path, a.mime
      FROM mensaje_interno_adjunto a
      JOIN mensaje_interno_destinatario d ON d.mensaje_id = a.mensaje_id
      WHERE a.id = $1 AND d.usuario_id = $2
      LIMIT 1
      `,
    [adjuntoId, session.id_usuario],
  );

  const row = r.rows[0];
  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Adjunto no encontrado (mensaje regenerado o sin acceso). Volvé a la bandeja y abrí el mensaje nuevo.",
      },
      { status: 404 },
    );
  }
  if (!row.storage_path || !existsSync(row.storage_path)) {
    return NextResponse.json(
      { ok: false, error: "Archivo no disponible en disco (path huérfano)" },
      { status: 404 },
    );
  }

  const nodeStream = createReadStream(row.storage_path);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const filename = row.nombre_archivo.split("/").pop() || row.nombre_archivo;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": row.mime || "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
