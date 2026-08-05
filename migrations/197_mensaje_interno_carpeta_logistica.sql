-- 197 · Mensajes internos · carpeta PDFs confirmación de entregas (Logística OK → vendedor)
-- Orden 5 = arriba de STOCK_PRONTA_ENTREGA (10) en bandeja.

INSERT INTO public.mensaje_interno_carpeta (codigo, nombre, orden)
VALUES
  (
    'LOGISTICA_CONFIRMACION_ENTREGAS',
    'PDFs confirmación de entregas',
    5
  )
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    orden = EXCLUDED.orden,
    activo = true;

COMMENT ON TABLE public.mensaje_interno_carpeta IS
  '2.3.1.36 · Carpetas bandeja · SPE + Logística confirmación entregas + General';
