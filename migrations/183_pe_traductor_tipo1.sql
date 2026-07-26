-- MIG-183 · Traductor PE Tipo 1 — Carlos valorizado → pilares tipo_1
-- Director 2026-07-25 · LENTES/ANTEOJOS · ACCESORIOS→ACT ROPAS

CREATE TABLE IF NOT EXISTS public.pe_traductor_tipo1 (
  codigo_barras   text PRIMARY KEY,
  cod_art_carlos  text NOT NULL UNIQUE,
  proveedor_id    integer NOT NULL,
  linea_cod       text NOT NULL,
  ref_cod         text NOT NULL DEFAULT '0',
  tipo0           text,
  tipo1_excel     text NOT NULL,
  tipo1_canon     text NOT NULL,
  filtro_ab_cr    text,
  marca           text,
  descripcion     text,
  notas           text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_traductor_tipo1_lr
  ON public.pe_traductor_tipo1 (proveedor_id, linea_cod, ref_cod);

CREATE INDEX IF NOT EXISTS idx_pe_traductor_tipo1_canon
  ON public.pe_traductor_tipo1 (tipo1_canon);

COMMENT ON TABLE public.pe_traductor_tipo1 IS
  'Traductor PE Tipo1 · Carlos codigo_barras → linea+ref+tipo_1 canónico · seed pe-traductor-tipo1.seed.json';

-- Semilla LENTES VIZZANO (7 SKUs · 4 moléculas 90000.1-4)
INSERT INTO public.pe_traductor_tipo1 (
  codigo_barras, cod_art_carlos, proveedor_id, linea_cod, ref_cod,
  tipo0, tipo1_excel, tipo1_canon, filtro_ab_cr, marca, descripcion, notas
) VALUES
  ('654.196046', '654-196046', 654, '90000', '4', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS NEW YORK/N SF CROCO MACAU B PRETO/CAC', 'seed 2026-07-25'),
  ('654.196043', '654-196043', 654, '90000', '2', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS RIO/VERNIZ SOFT BRILHO BAG N NEGRO/PI', 'seed 2026-07-25'),
  ('654.190220', '654-190220', 654, '90000', '1', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS MILAO/NAPA LEZARD PARIS NEGRO/NEGRO', 'seed 2026-07-25'),
  ('654.196047', '654-196047', 654, '90000', '4', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS NEW YORK/N SF CROCO MACAU B PRETO-TAR', 'seed 2026-07-25'),
  ('654.196042', '654-196042', 654, '90000', '2', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS RIO/VERNIZ SOFT BRILHO BAG N LILA/PIN', 'seed 2026-07-25'),
  ('654.190211', '654-190211', 654, '90000', '3', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS PARIS/NP METAL SOFT STR B N NEGRO/DOR', 'seed 2026-07-25'),
  ('654.196044', '654-196044', 654, '90000', '2', 'CALZADOS', 'LENTES', 'LENTES', 'ANTEOJOS', 'VIZZANO', 'OCULOS RIO/VERNIZ SOFT BRILHO BAG N ROSA/PIN', 'seed 2026-07-25')
ON CONFLICT (codigo_barras) DO UPDATE SET
  cod_art_carlos = EXCLUDED.cod_art_carlos,
  proveedor_id   = EXCLUDED.proveedor_id,
  linea_cod      = EXCLUDED.linea_cod,
  ref_cod        = EXCLUDED.ref_cod,
  tipo0          = EXCLUDED.tipo0,
  tipo1_excel    = EXCLUDED.tipo1_excel,
  tipo1_canon    = EXCLUDED.tipo1_canon,
  filtro_ab_cr    = EXCLUDED.filtro_ab_cr,
  marca          = EXCLUDED.marca,
  descripcion    = EXCLUDED.descripcion,
  notas          = EXCLUDED.notas,
  updated_at     = now();

-- Vista impacto PE stock
CREATE OR REPLACE VIEW public.v_pe_traductor_tipo1_impacto AS
SELECT
  t.codigo_barras,
  t.cod_art_carlos,
  t.linea_cod,
  t.ref_cod,
  t.tipo1_canon,
  t.filtro_ab_cr,
  t.marca,
  t.descripcion,
  spe.deposito_codigo,
  spe.cantidad,
  lr.tipo_1_id AS tipo_1_id_actual,
  t1.descp_tipo_1 AS tipo_1_label_actual,
  (upper(btrim(t1.descp_tipo_1)) = upper(btrim(t.tipo1_canon))) AS tipo1_ok
FROM public.pe_traductor_tipo1 t
LEFT JOIN public.stock_pronta_entrega_rimec spe
  ON btrim(spe.codigo_barras) = btrim(t.codigo_barras)
LEFT JOIN public.linea l
  ON l.proveedor_id = t.proveedor_id
 AND l.codigo_proveedor::text = t.linea_cod
LEFT JOIN public.referencia r
  ON r.linea_id = l.id
 AND r.codigo_proveedor::text = t.ref_cod
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id
 AND lr.referencia_id = r.id
LEFT JOIN public.tipo_1 t1
  ON t1.id_tipo_1 = lr.tipo_1_id;

COMMENT ON VIEW public.v_pe_traductor_tipo1_impacto IS
  'Auditoría traductor Tipo1 vs stock PE y linea_referencia';
