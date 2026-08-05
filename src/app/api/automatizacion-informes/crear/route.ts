import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { cadenaPeFromTipoId, type PeTipoDiccionarioId } from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import { normalizarDiasSemana } from "@/lib/automatizacion-informes/reloj";

type DestBody = {
  usuario_id: number;
  nombre?: string;
  email?: string;
};

type Body = {
  nombre: string;
  origen_stock: "COMPRA_PREVIA" | "PRONTA_ENTREGA";
  depositos: string[];
  ramo: "CALZADO" | "CONFECCIONES";
  marcas: string[];
  abcr_labels: string[];
  tipos: PeTipoDiccionarioId[];
  biblioteca_precio_ids: number[];
  /** Horas HH:MM del día — ej. ["08:00","12:00","15:00"] */
  horarios: string[];
  /** ISO 1=lun … 7=dom — ej. [1] = solo lunes */
  dias_semana?: number[];
  destinatarios: DestBody[];
};

function normalizarHorarios(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of arr) {
    const s = String(h ?? "").trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const hh = Math.min(23, Math.max(0, Number(m[1]))).toString().padStart(2, "0");
    const mm = Math.min(59, Math.max(0, Number(m[2]))).toString().padStart(2, "0");
    const key = `${hh}:${mm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  out.sort();
  return out;
}

/**
 * POST · crea automatización: filtros + multi-usuarios + multi-horarios en SQL.
 * Una automatización = un paquete (ej. solo Moleca). Otra = Vizzano a otra hora.
 */
export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ ok: false, error: "nombre obligatorio" }, { status: 400 });
  }
  if (body.origen_stock !== "COMPRA_PREVIA" && body.origen_stock !== "PRONTA_ENTREGA") {
    return NextResponse.json({ ok: false, error: "origen_stock inválido" }, { status: 400 });
  }
  const depositos = (body.depositos ?? []).filter((d) =>
    ["D1", "DEP2", "D3"].includes(d),
  );
  if (!depositos.length) {
    return NextResponse.json({ ok: false, error: "elegí al menos un depósito" }, { status: 400 });
  }
  if (body.ramo !== "CALZADO" && body.ramo !== "CONFECCIONES") {
    return NextResponse.json({ ok: false, error: "ramo inválido" }, { status: 400 });
  }

  const horarios = normalizarHorarios(body.horarios);
  if (!horarios.length) {
    return NextResponse.json(
      { ok: false, error: "agregá al menos un horario (ej. 08:00)" },
      { status: 400 },
    );
  }
  const diasSemana = normalizarDiasSemana(body.dias_semana);

  const destIds = [
    ...new Set(
      (Array.isArray(body.destinatarios) ? body.destinatarios : [])
        .map((d) => Number(d.usuario_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (!destIds.length) {
    return NextResponse.json(
      { ok: false, error: "seleccioná al menos un usuario destinatario" },
      { status: 400 },
    );
  }

  const tiposDpe = (body.tipos ?? []).map((id) => cadenaPeFromTipoId(id));
  const codigo = `auto-${body.origen_stock === "PRONTA_ENTREGA" ? "pe" : "cp"}-${Date.now()}`;
  const pool = getRimecPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const users = await client.query<{
      id_usuario: number;
      nombre: string;
      email: string;
    }>(
      `
      SELECT
        id_usuario,
        TRIM(descp_usuario) AS nombre,
        LOWER(TRIM(email)) AS email
      FROM public.usuario_v2
      WHERE id_usuario = ANY($1::bigint[])
        AND COALESCE(bloqueado, false) = false
        AND email IS NOT NULL
        AND TRIM(email) <> ''
      `,
      [destIds],
    );
    if (!users.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "ningún usuario seleccionado tiene email válido" },
        { status: 400 },
      );
    }

    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO public.informe_automatizacion_envio (
        codigo, nombre, origen_stock, depositos, ramo,
        marcas, abcr_labels, tipos_dpe, biblioteca_precio_ids,
        horarios, dias_semana, segregar_lpn_lpc03, pdf_por_marca_caso, created_by_usuario_id
      ) VALUES (
        $1, $2, $3, $4::text[], $5,
        $6::text[], $7::text[], $8::text[], $9::bigint[],
        $10::time[], $11::int[], true, true, $12
      )
      RETURNING id::text
      `,
      [
        codigo,
        nombre,
        body.origen_stock,
        depositos,
        body.ramo,
        (body.marcas ?? []).map((m) => m.trim().toUpperCase()).filter(Boolean),
        (body.abcr_labels ?? []).map((a) => a.trim().toUpperCase()).filter(Boolean),
        tiposDpe,
        body.biblioteca_precio_ids ?? [],
        horarios,
        diasSemana,
        gate.session?.id_usuario ?? null,
      ],
    );
    const autoId = Number(ins.rows[0]!.id);
    const horarioLegado = horarios[0]!;

    for (const u of users.rows) {
      await client.query(
        `
        INSERT INTO public.informe_automatizacion_destinatario (
          automatizacion_id, usuario_id, nombre, email, horario, veces_por_dia
        ) VALUES ($1, $2, $3, $4, $5::time, $6)
        `,
        [
          autoId,
          u.id_usuario,
          u.nombre || u.email,
          u.email,
          horarioLegado,
          horarios.length,
        ],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      id: autoId,
      codigo,
      horarios,
      dias_semana: diasSemana,
      destinatarios: users.rows.length,
      reglas_pdf: { pdf_por_marca_caso: true, segregar_lpn_lpc03: true },
      reloj: "Worker local lee dias_semana + horarios (America/Asuncion)",
    });
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al crear";
    const missing192 = /informe_automatizacion/i.test(msg);
    const missing193 = /horarios/i.test(msg) && /column/i.test(msg);
    const missing195 = /dias_semana/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        error: missing195
          ? "Falta migración 195_informe_automatizacion_reloj.sql"
          : missing193
            ? "Falta migración 193_informe_automatizacion_horarios.sql"
            : missing192
              ? "Falta migración 192_informe_automatizacion_envio.sql en la BD"
              : msg,
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
