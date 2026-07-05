"""Inspecciona y corrige fn_validar_usuario_triada — quita regla usuario→funcionario."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

NEW_FUNCTION = """
CREATE OR REPLACE FUNCTION public.fn_validar_usuario_triada()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_cat_nivel int2;
  v_rol_nivel int2;
  v_ente_codigo int;
  v_ente_cliente int;
  v_cat_codigo text;
BEGIN
  IF NEW.categoria_id IS NULL THEN
    SELECT id_categoria INTO NEW.categoria_id
    FROM public.usuario_categoria
    WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(COALESCE(NEW.categoria, '')))
    LIMIT 1;
  END IF;

  SELECT c.nivel, c.codigo INTO v_cat_nivel, v_cat_codigo
  FROM public.usuario_categoria c
  WHERE c.id_categoria = NEW.categoria_id;

  SELECT r.nivel INTO v_rol_nivel
  FROM public.maestro_rol_acceso r
  WHERE r.id = NEW.rol_id;

  SELECT e.codigo, e.cliente_id INTO v_ente_codigo, v_ente_cliente
  FROM public.entes e
  WHERE e.id_ente = NEW.ente_id;

  IF v_cat_nivel IS NULL OR v_rol_nivel IS NULL THEN
    RAISE EXCEPTION 'LEY TRIADA: categoria_id y rol_id válidos requeridos';
  END IF;

  IF v_ente_codigo IS NULL THEN
    RAISE EXCEPTION 'ente_id requerido — tabla entes principal (sin cliente_id)';
  END IF;

  IF v_ente_cliente IS NOT NULL THEN
    RAISE EXCEPTION 'usuario_v2.ente_id debe ser ente principal (RIMEC/tienda). Codigo cliente va en funcionarios.punto_ente_id (RRHH)';
  END IF;

  IF v_cat_nivel < v_rol_nivel THEN
    RAISE EXCEPTION 'LEY TRIADA: categoría (nivel %) no puede ser superior al rol (nivel %)',
      v_cat_nivel, v_rol_nivel;
  END IF;

  IF v_cat_nivel = 1 THEN
    IF v_rol_nivel <> 1 OR COALESCE(v_ente_codigo, 999) <> 1 THEN
      RAISE EXCEPTION 'DIOS requiere ente RIMEC (cod 1), rol GERENTE (nivel 1) y categoría DIOS (nivel 1)';
    END IF;
  END IF;

  IF NEW.categoria IS NULL OR btrim(NEW.categoria) = '' THEN
    NEW.categoria := v_cat_codigo;
  END IF;

  -- Usuario (acceso) independiente de funcionario RRHH (Director 2026-06-25).

  RETURN NEW;
END;
$function$;
"""


def main() -> int:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL no definido en report/.env.local")
        return 1

    dry_run = "--dry-run" in sys.argv
    inspect_only = "--inspect" in sys.argv

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'fn_validar_usuario_triada'
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        print("ERROR: fn_validar_usuario_triada no existe en BD")
        return 1

    current = row[0]
    print("=== FUNCIÓN ACTUAL ===")
    print(current)
    print("======================")

    if re.search(r"funcionario_id|Gerentes y administradores", current, re.I):
        print("Detectada regla legacy funcionario_id — se reemplazará.")
    else:
        print("No se detectó regla funcionario_id en texto actual.")

    if inspect_only:
        return 0

    if dry_run:
        print("DRY RUN — no se aplicó cambio.")
        return 0

    cur.execute(NEW_FUNCTION)
    conn.commit()
    print("OK: fn_validar_usuario_triada actualizada (sin dependencia funcionario).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
