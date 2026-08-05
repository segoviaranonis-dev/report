import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { DIAS_LABEL, restarMinutos, minutosPrepPdf } from "@/lib/automatizacion-informes/reloj";

/**
 * GET · menú diario de automatizaciones (lenguaje simple para gerencia).
 */
export async function GET() {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Base no configurada" }, { status: 503 });
  }

  try {
    const pool = getRimecPool();
    const r = await pool.query<{
      id: string;
      nombre: string;
      activo: boolean;
      origen_stock: string;
      ramo: string;
      marcas: string[];
      depositos: string[];
      horarios: string[];
      dias_semana: number[];
      created_at: Date;
      destinatarios: string;
      n_dest: string;
    }>(
      `
      SELECT
        e.id::text,
        e.nombre,
        e.activo,
        e.origen_stock,
        e.ramo,
        COALESCE(e.marcas, '{}') AS marcas,
        COALESCE(e.depositos, '{}') AS depositos,
        COALESCE(e.horarios::text[], '{}') AS horarios,
        COALESCE(e.dias_semana, '{1,2,3,4,5,6,7}') AS dias_semana,
        e.created_at,
        COALESCE(
          string_agg(DISTINCT NULLIF(TRIM(d.nombre), ''), ', ' ORDER BY NULLIF(TRIM(d.nombre), '')),
          ''
        ) AS destinatarios,
        COUNT(DISTINCT d.id)::text AS n_dest
      FROM informe_automatizacion_envio e
      LEFT JOIN informe_automatizacion_destinatario d
        ON d.automatizacion_id = e.id AND d.activo = true
      WHERE e.activo = true
      GROUP BY e.id
      ORDER BY e.horarios[1] NULLS LAST, e.nombre
      `,
    );

    const prepMin = minutosPrepPdf();
    const items = r.rows.map((row) => {
      const horas = (row.horarios ?? []).map((h) => {
        const m = String(h).match(/(\d{1,2}):(\d{2})/);
        return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : String(h).slice(0, 5);
      });
      const dias = (row.dias_semana ?? [])
        .map((id) => DIAS_LABEL.find((d) => d.id === id)?.largo ?? String(id));
      const todosLosDias = (row.dias_semana ?? []).length >= 7;
      return {
        id: Number(row.id),
        nombre: row.nombre,
        marcas: row.marcas?.length ? row.marcas : ["Todas las marcas"],
        depositos: row.depositos ?? [],
        ramo: row.ramo === "CONFECCIONES" ? "Confecciones" : "Calzado",
        origen:
          row.origen_stock === "COMPRA_PREVIA" ? "Compra previa" : "Stock pronta entrega",
        horas,
        prep_horas: horas.map((h) => restarMinutos(h, prepMin)),
        dias_texto: todosLosDias ? "Todos los días" : dias.join(", "),
        para_quien: row.destinatarios || "Sin destinatarios",
        n_personas: Number(row.n_dest) || 0,
      };
    });

    return NextResponse.json({
      ok: true,
      prep_minutos: prepMin,
      total: items.length,
      items,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
