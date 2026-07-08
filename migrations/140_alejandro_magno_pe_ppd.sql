-- MIG-140 — Alejandro Magno: PE en pedido_proveedor + pedido_proveedor_detalle
-- Discriminadores: quincena_desc = 'Pronta entrega' · entidad_comercial = STOCK
-- · estado_transito = EN_DEPOSITO · categoria_id = 1 (STOCK)
-- Doc: ESTRATEGIA_HIEDRA_VENENOSA_PE.md · CHUSAR_ALEJANDRO_MAGNO_TRES_ENTIDADES.md
-- Datos: control_central/scripts/migrate_pe_staging_to_ppd.py (post DDL)

-- ── Quincena canónica PE (id manual — tabla sin serial) ───────────────────────
INSERT INTO public.quincena_arribo (id, descripcion)
SELECT 25, 'Pronta entrega'
WHERE NOT EXISTS (
  SELECT 1 FROM public.quincena_arribo qa
  WHERE lower(trim(qa.descripcion)) = lower('Pronta entrega')
);

-- ── Columnas identificadoras en cabecera PP ─────────────────────────────────
ALTER TABLE public.pedido_proveedor
  ADD COLUMN IF NOT EXISTS deposito_codigo text
    CHECK (deposito_codigo IS NULL OR deposito_codigo IN ('D1', 'DEP2', 'D3'));

COMMENT ON COLUMN public.pedido_proveedor.deposito_codigo IS
  'PE import CSV sdrm · D1|DEP2|D3 · NULL en PP proceso importación';

-- ── Trazabilidad staging → PPD (puente retirable) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_pe_staging_migrated (
  staging_id bigint PRIMARY KEY,
  ppd_id     bigint NOT NULL REFERENCES public.pedido_proveedor_detalle (id) ON DELETE CASCADE,
  pp_id      bigint NOT NULL REFERENCES public.pedido_proveedor (id) ON DELETE CASCADE,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_pe_staging_migrated_ppd
  ON public.stock_pe_staging_migrated (ppd_id);

COMMENT ON TABLE public.stock_pe_staging_migrated IS
  'Mapa stock_pronta_entrega_rimec.id → ppd.id · MIG-140 Alejandro Magno';
