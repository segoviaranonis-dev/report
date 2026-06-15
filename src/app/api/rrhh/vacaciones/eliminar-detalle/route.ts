import { NextRequest, NextResponse } from 'next/server';
import { getRimecPool } from '@/lib/rimec/pool';

export async function DELETE(request: NextRequest) {
  try {
    const { id_detalle } = await request.json();

    if (!id_detalle) {
      return NextResponse.json({ error: 'id_detalle requerido' }, { status: 400 });
    }

    const pool = getRimecPool();

    // Obtener datos del detalle antes de eliminar
    const { rows: detalleRows } = await pool.query(
      `SELECT vd.vacacion_id, vd.dias_tomados, vd.horas_tomadas
       FROM vacaciones_detalle vd
       WHERE vd.id_detalle = $1`,
      [id_detalle]
    );

    if (detalleRows.length === 0) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    const detalle = detalleRows[0];

    // Eliminar el registro
    await pool.query(
      `DELETE FROM vacaciones_detalle WHERE id_detalle = $1`,
      [id_detalle]
    );

    // Actualizar contadores en vacaciones (restar lo que se eliminó)
    const { rows: updated } = await pool.query(
      `UPDATE vacaciones
       SET
         dias_tomados = GREATEST(0, dias_tomados - $1),
         horas_tomadas = GREATEST(0, horas_tomadas - $2),
         dias_pendientes = dias_totales - GREATEST(0, dias_tomados - $1),
         horas_pendientes = horas_totales - GREATEST(0, horas_tomadas - $2),
         updated_at = NOW()
       WHERE id_vacacion = $3
       RETURNING funcionario_id, anio, dias_tomados, horas_tomadas, dias_pendientes, horas_pendientes`,
      [detalle.dias_tomados, detalle.horas_tomadas, detalle.vacacion_id]
    );

    return NextResponse.json({
      success: true,
      mensaje: 'Registro eliminado y contadores actualizados',
      vacacion: updated[0] ?? null,
    });
  } catch (error) {
    console.error('[API eliminar-detalle]', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
