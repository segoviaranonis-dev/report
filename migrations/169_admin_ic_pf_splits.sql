-- MIG-169 — Admin IC · divisiones prefactura (Protocolo Chusa)
-- JSON: [{ id, parent_pf_key, pf_key, id_cliente, id_marca, caso, pares, articulos: [{ ppd_id, pares }] }]

ALTER TABLE public.pedido_proveedor
  ADD COLUMN IF NOT EXISTS admin_ic_pf_splits JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pedido_proveedor.admin_ic_pf_splits IS
  'Divisiones virtuales prefactura Admin IC · pares parciales por ppd_id · Chusa IC=PF=FI';
