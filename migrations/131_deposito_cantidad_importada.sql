-- MIG-131 · Hiedra Venenosa · trazabilidad import CSV vs ventas POS
-- cantidad_importada = snapshot al import/sync; cantidad = saldo vivo (baja al vender)

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'deposito_1_2100_tienda', 'deposito_2_2100_guardado', 'deposito_3_2100_averiado',
    'deposito_1_2900_tienda', 'deposito_2_2900_guardado', 'deposito_3_2900_averiado',
    'deposito_1_2400_tienda', 'deposito_2_2400_guardado', 'deposito_3_2400_averiado',
    'deposito_1_2700_tienda', 'deposito_2_2700_guardado', 'deposito_3_2700_averiado',
    'deposito_1_3100_tienda', 'deposito_2_3100_guardado', 'deposito_3_3100_averiado',
    'deposito_1_3200_tienda', 'deposito_2_3200_guardado', 'deposito_3_3200_averiado'
  ];
BEGIN
  FOREACH t IN ARRAY tablas
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cantidad_importada integer',
        t
      );
      EXECUTE format(
        'UPDATE public.%I SET cantidad_importada = cantidad WHERE cantidad_importada IS NULL',
        t
      );
    END IF;
  END LOOP;
END $$;
