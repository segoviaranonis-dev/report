-- MIG-136 — confirmar_pedido_web + carrito: rama PRONTA ENTREGA (det_id >= 800000000)
-- Doc: .claude/2_modulos/2.3_report/gestion_compra/CHUSAR_ALEJANDRO_MAGNO_TRES_ENTIDADES.md
-- Aplicar en Supabase prod tras revisión Claude Code (parche sobre RPC vigente).

-- NOTA: este archivo documenta la rama requerida. El cuerpo completo del RPC
-- debe tomarse del último confirmar_pedido_web en pg_proc y extenderse.

/*
  Por cada item del payload con det_id >= 800000000:
    stock_id := det_id - 800000000
    pares := item.pares (desde payload JSON)
    UPDATE stock_pronta_entrega_rimec
      SET cantidad = GREATEST(0, cantidad - pares)
      WHERE id = stock_id
    INSERT factura_interna + factura_interna_detalle
      (origen PE · track Aprobaciones color · sin ppd_id real)
    origen_tipo := 'PRONTA_ENTREGA' en payload para trazabilidad

  carrito_validar: aceptar det_id >= 800000000 leyendo v_stock_rimec.cajas_disponibles
*/

COMMENT ON VIEW public.v_stock_rimec IS
  'MIG-134/136 · TRÁNSITO_PP UNION PRONTA_ENTREGA · venta web det_id sintético >= 800000000';
