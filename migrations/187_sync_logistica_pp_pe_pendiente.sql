-- MIG-187 · Alinear sync_logistica_pp_if_bandera con sync-pp.ts (Report)
-- Ley PE: solo FI CONFIRMADA · estado logística PE siempre PENDIENTE al sync.
-- Cierra brecha pre-sync Web (Graciela PE-220-001) · CHUSAR 2.3.1.28.12 P1

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_logistica_pp_if_bandera(p_pp_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha DATE;
  v_activa BOOLEAN;
  v_entidad TEXT;
  v_synced INT := 0;
BEGIN
  IF p_pp_id IS NULL OR p_pp_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pp_id inválido', 'synced', 0);
  END IF;

  SELECT pp.fecha_arribo_real, COALESCE(pp.logistica_bandera_activa, false)
    INTO v_fecha, v_activa
  FROM public.pedido_proveedor pp
  WHERE pp.id = p_pp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PP no encontrado', 'synced', 0);
  END IF;

  IF NOT v_activa OR v_fecha IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'bandera_off_o_sin_fecha',
      'synced', 0
    );
  END IF;

  v_entidad := public.logistica_ok_resolver_entidad_am(p_pp_id);

  INSERT INTO public.logistica_pendiente_confirmacion (
    factura_interna_id, pedido_proveedor_id, entidad_am, fecha_orden,
    id_cliente, id_cadena, id_vendedor, pares, cajas, monto_neto, nro_factura,
    fecha_entrega_vendedor, estado, updated_at
  )
  SELECT
    fi.id,
    fi.pp_id,
    v_entidad,
    v_fecha,
    fi.cliente_id,
    cad.id_cadena,
    fi.vendedor_id,
    COALESCE(fi.total_pares, 0)::int,
    COALESCE((
      SELECT SUM(fid.cajas)::int
      FROM public.factura_interna_detalle fid
      WHERE fid.factura_id = fi.id
    ), 0),
    fi.total_monto,
    fi.nro_factura,
    CASE
      WHEN fi.fecha_entrega_cliente IS NOT NULL
       AND EXTRACT(YEAR FROM fi.fecha_entrega_cliente::timestamp) >= 2000
      THEN fi.fecha_entrega_cliente
      ELSE NULL
    END,
    CASE
      WHEN v_entidad = 'PE' THEN 'PENDIENTE'
      WHEN fi.fecha_entrega_cliente IS NOT NULL
       AND EXTRACT(YEAR FROM fi.fecha_entrega_cliente::timestamp) >= 2000
      THEN 'CONFIRMADA'
      ELSE 'PENDIENTE'
    END,
    now()
  FROM public.factura_interna fi
  LEFT JOIN LATERAL (
    SELECT cc.id_cadena
    FROM public.cliente_cadena_v2 cc
    WHERE cc.id_cliente = fi.cliente_id
    ORDER BY cc.id_cadena
    LIMIT 1
  ) cad ON true
  WHERE fi.pp_id = p_pp_id
    AND fi.estado = 'CONFIRMADA'
    AND fi.cliente_id IS NOT NULL
  ON CONFLICT (factura_interna_id) DO UPDATE SET
    pedido_proveedor_id = EXCLUDED.pedido_proveedor_id,
    entidad_am = EXCLUDED.entidad_am,
    fecha_orden = EXCLUDED.fecha_orden,
    id_cliente = EXCLUDED.id_cliente,
    id_cadena = EXCLUDED.id_cadena,
    id_vendedor = EXCLUDED.id_vendedor,
    pares = EXCLUDED.pares,
    cajas = EXCLUDED.cajas,
    monto_neto = EXCLUDED.monto_neto,
    nro_factura = EXCLUDED.nro_factura,
    fecha_entrega_vendedor = COALESCE(
      EXCLUDED.fecha_entrega_vendedor,
      logistica_pendiente_confirmacion.fecha_entrega_vendedor
    ),
    estado = CASE
      WHEN EXCLUDED.entidad_am = 'PE' THEN 'PENDIENTE'
      WHEN EXCLUDED.fecha_entrega_vendedor IS NOT NULL THEN 'CONFIRMADA'
      ELSE logistica_pendiente_confirmacion.estado
    END,
    updated_at = now()
  WHERE logistica_pendiente_confirmacion.estado = 'PENDIENTE';

  GET DIAGNOSTICS v_synced = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'synced', v_synced,
    'entidad_am', v_entidad,
    'fecha_orden', v_fecha,
    'pp_id', p_pp_id
  );
END;
$$;

COMMENT ON FUNCTION public.sync_logistica_pp_if_bandera(INTEGER) IS
  'MIG-187 · Sync FI CONFIRMADA→logistica si bandera ON. PE siempre PENDIENTE. Paridad sync-pp.ts.';

-- Backfill: PE CONFIRMADA sin confirmado_at = pre-sync / bug (no pasó por UI Logística)
UPDATE public.logistica_pendiente_confirmacion l
SET estado = 'PENDIENTE',
    updated_at = now()
WHERE l.entidad_am = 'PE'
  AND l.estado = 'CONFIRMADA'
  AND l.confirmado_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.factura_interna fi
    WHERE fi.id = l.factura_interna_id
      AND fi.estado = 'CONFIRMADA'
  );

-- Purga filas logística creadas antes de confirmar FI (pre-sync Web / MIG-181 viejo)
DELETE FROM public.logistica_pendiente_confirmacion l
USING public.factura_interna fi
WHERE fi.id = l.factura_interna_id
  AND fi.estado = 'RESERVADA';

COMMIT;
