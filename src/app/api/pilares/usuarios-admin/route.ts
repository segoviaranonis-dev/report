import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { FuncionarioExcelRow } from "@/lib/usuarios-admin/import-funcionarios";
import {
  createUsuario,
  importUsuariosFromFuncionariosExcel,
  loadUsuariosAdminSnapshot,
  previewImportFuncionariosExcel,
  updateUsuario,
  updateUsuarioCategoriaCatalogo,
} from "@/lib/usuarios-admin/queries";

function localOnly() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Solo disponible en dev local" }, { status: 404 });
  }
  return null;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.rol_id !== 1) {
    return { session: null, error: NextResponse.json({ error: "rol_id=1 requerido" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function GET() {
  const blocked = localOnly();
  if (blocked) return blocked;

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const data = await loadUsuariosAdminSnapshot();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[pilares/usuarios-admin GET]", e);
    return NextResponse.json({ error: "Error cargando catálogo" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = localOnly();
  if (blocked) return blocked;

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const target = String(body.target || "");

  try {
    if (target === "create") {
      const descpUsuario = String(body.descp_usuario ?? "").trim();
      const password = body.password != null ? String(body.password) : undefined;
      const rolId = Number(body.rol_id);
      const categoriaId = Number(body.categoria_id);
      const enteId = Number(body.ente_id);
      const esExterno = Boolean(body.es_externo);
      const email = body.email != null ? String(body.email) : null;

      if (!descpUsuario) {
        return NextResponse.json({ error: "descp_usuario requerido" }, { status: 400 });
      }
      if (!rolId || !categoriaId || !enteId) {
        return NextResponse.json({ error: "rol_id, categoria_id y ente_id requeridos" }, { status: 400 });
      }

      const created = await createUsuario({
        descpUsuario,
        password,
        rolId,
        categoriaId,
        enteId,
        esExterno,
        email,
      });
      return NextResponse.json({ ok: true, usuario: created });
    }

    if (target === "import-preview") {
      const rows = body.rows as FuncionarioExcelRow[];
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "rows[] requerido" }, { status: 400 });
      }
      const preview = await previewImportFuncionariosExcel(rows);
      return NextResponse.json({ ok: true, preview });
    }

    if (target === "import-usuarios-excel" || target === "import-funcionarios") {
      const rows = body.rows as FuncionarioExcelRow[];
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "rows[] requerido" }, { status: 400 });
      }
      const passwordMode = body.password_mode === "random" ? "random" : "ci";
      const dryRun = Boolean(body.dry_run);
      const result = await importUsuariosFromFuncionariosExcel(rows, { passwordMode, dryRun });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "target inválido" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en operación";
    console.error("[pilares/usuarios-admin POST]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const blocked = localOnly();
  if (blocked) return blocked;

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json();
  const target = String(body.target || "");

  try {
    if (target === "usuario") {
      const idUsuario = Number(body.id_usuario);
      const rolId = Number(body.rol_id);
      const categoriaId = Number(body.categoria_id);
      const enteId = Number(body.ente_id);
      const esExterno = Boolean(body.es_externo);
      const descpUsuario =
        body.descp_usuario != null ? String(body.descp_usuario).trim() : undefined;
      const password =
        body.password != null && String(body.password).trim()
          ? String(body.password).trim()
          : undefined;
      const email = body.email !== undefined ? (body.email ? String(body.email) : null) : undefined;
      const bloqueado = body.bloqueado !== undefined ? Boolean(body.bloqueado) : undefined;

      if (!idUsuario) {
        return NextResponse.json({ error: "id_usuario requerido" }, { status: 400 });
      }
      if (!enteId) {
        return NextResponse.json({ error: "ente_id requerido — tabla entes" }, { status: 400 });
      }
      if (!categoriaId) {
        return NextResponse.json({ error: "categoria_id requerido" }, { status: 400 });
      }
      if (idUsuario === auth.session!.id_usuario) {
        return NextResponse.json({ error: "No editar su propio usuario aquí" }, { status: 400 });
      }

      const result = await updateUsuario({
        idUsuario,
        descpUsuario,
        password,
        email,
        bloqueado,
        rolId,
        categoriaId,
        enteId,
        esExterno,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (target === "categoria") {
      const idCategoria = Number(body.id_categoria);
      if (!idCategoria) {
        return NextResponse.json({ error: "id_categoria requerido" }, { status: 400 });
      }
      await updateUsuarioCategoriaCatalogo(idCategoria, {
        descripcion: body.descripcion != null ? String(body.descripcion) : undefined,
        activo: body.activo != null ? Boolean(body.activo) : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "target inválido" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error actualizando";
    console.error("[pilares/usuarios-admin PATCH]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
