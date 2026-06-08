import { NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type VentasDiaSemana = {
  dia: string;
  cantidad: number;
  monto: number;
};

export type VentasSemana = {
  numeroSemana: number;
  fechaInicio: string;
  fechaFin: string;
  dias: VentasDiaSemana[];
};

export type VentasEnteResponse = {
  ente: string;
  semanas: VentasSemana[];
};

export type VentasSemanasResponse = {
  configured: boolean;
  entes: VentasEnteResponse[];
  error?: string;
};

/**
 * API: Ventas por ente, semana y día de la semana
 */
export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      entes: [],
    } satisfies VentasSemanasResponse);
  }

  try {
    const pool = getRimecPool();

    // Primero obtenemos los rangos de fechas por semana y ente
    const { rows: rangosSemanas } = await pool.query<{
      ente_norm: string;
      numero_semana: number;
      fecha_inicio: string;
      fecha_fin: string;
    }>(`
      SELECT
        CASE
          WHEN s.cliente_id IN (2100, 2900) THEN 'Fernando'
          WHEN s.cliente_id IN (2400, 2700) THEN 'San Martin'
          WHEN s.cliente_id IN (3100, 3200) THEN 'Palma'
          WHEN s.cliente_id IS NULL THEN 'RIMEC'
          ELSE 'Otros'
        END AS ente_norm,
        EXTRACT(WEEK FROM s.fecha_mov)::int AS numero_semana,
        MIN(s.fecha_mov)::text AS fecha_inicio,
        MAX(s.fecha_mov)::text AS fecha_fin
      FROM public.registro_st_vt_rc_reposicion s
      WHERE s.fecha_mov IS NOT NULL
        AND lower(btrim(s.tipo_movimiento)) = 'venta'
      GROUP BY ente_norm, numero_semana
    `);

    const { rows } = await pool.query<{
      ente_norm: string;
      numero_semana: number;
      dia_semana: number;
      nombre_dia: string;
      cantidad: string;
      monto: string;
    }>(`
      SELECT
        CASE
          WHEN s.cliente_id IN (2100, 2900) THEN 'Fernando'
          WHEN s.cliente_id IN (2400, 2700) THEN 'San Martin'
          WHEN s.cliente_id IN (3100, 3200) THEN 'Palma'
          WHEN s.cliente_id IS NULL THEN 'RIMEC'
          ELSE 'Otros'
        END AS ente_norm,
        EXTRACT(WEEK FROM s.fecha_mov)::int AS numero_semana,
        EXTRACT(DOW FROM s.fecha_mov)::int AS dia_semana,
        CASE EXTRACT(DOW FROM s.fecha_mov)::int
          WHEN 0 THEN 'Domingo'
          WHEN 1 THEN 'Lunes'
          WHEN 2 THEN 'Martes'
          WHEN 3 THEN 'Miércoles'
          WHEN 4 THEN 'Jueves'
          WHEN 5 THEN 'Viernes'
          WHEN 6 THEN 'Sábado'
        END AS nombre_dia,
        SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'venta' THEN s.cantidad::float8 ELSE 0 END)::text AS cantidad,
        SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'venta' THEN s.cantidad::float8 * COALESCE(s.precio_unitario::float8, 0) ELSE 0 END)::text AS monto
      FROM public.registro_st_vt_rc_reposicion s
      WHERE s.fecha_mov IS NOT NULL
        AND lower(btrim(s.tipo_movimiento)) = 'venta'
      GROUP BY ente_norm, numero_semana, dia_semana, nombre_dia
      ORDER BY ente_norm, numero_semana, dia_semana
    `);

    // Agrupar por ente
    const entesMap = new Map<string, VentasEnteResponse>();

    rows.forEach(row => {
      if (!entesMap.has(row.ente_norm)) {
        entesMap.set(row.ente_norm, {
          ente: row.ente_norm,
          semanas: []
        });
      }

      const ente = entesMap.get(row.ente_norm)!;

      // Buscar o crear semana
      let semana = ente.semanas.find(s => s.numeroSemana === row.numero_semana);
      if (!semana) {
        // Buscar fechas de esta semana
        const rango = rangosSemanas.find(r => r.ente_norm === row.ente_norm && r.numero_semana === row.numero_semana);

        semana = {
          numeroSemana: row.numero_semana,
          fechaInicio: rango?.fecha_inicio || '',
          fechaFin: rango?.fecha_fin || '',
          dias: []
        };
        ente.semanas.push(semana);
      }

      // Agregar día (solo Lunes a Viernes, DOW 1-5)
      if (row.dia_semana >= 1 && row.dia_semana <= 5) {
        semana.dias.push({
          dia: row.nombre_dia,
          cantidad: Number(row.cantidad) || 0,
          monto: Number(row.monto) || 0
        });
      }
    });

    // Ordenar semanas y completar días faltantes
    entesMap.forEach(ente => {
      ente.semanas.sort((a, b) => a.numeroSemana - b.numeroSemana);

      ente.semanas.forEach(semana => {
        const diasExistentes = new Set(semana.dias.map(d => d.dia));
        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

        diasSemana.forEach(dia => {
          if (!diasExistentes.has(dia)) {
            semana.dias.push({ dia, cantidad: 0, monto: 0 });
          }
        });

        // Ordenar días
        const ordenDias: { [key: string]: number } = {
          'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5
        };
        semana.dias.sort((a, b) => ordenDias[a.dia] - ordenDias[b.dia]);
      });
    });

    const entes = Array.from(entesMap.values());

    return NextResponse.json({
      configured: true,
      entes,
    } satisfies VentasSemanasResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar ventas por semanas";
    return NextResponse.json(
      {
        configured: true,
        entes: [],
        error: msg,
      } satisfies VentasSemanasResponse,
      { status: 500 },
    );
  }
}
