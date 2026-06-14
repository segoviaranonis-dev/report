#!/usr/bin/env python3
"""Smoke MIG-114 + conteo filas CSV general (sin exportar archivo)."""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")
url = os.getenv("DATABASE_URL")
if not url:
    print("FAIL: DATABASE_URL", file=sys.stderr)
    sys.exit(1)

conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute(
    """
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'factura_interna'
      AND column_name = 'fecha_confirmacion'
    """
)
assert cur.fetchone(), "columna fecha_confirmacion ausente"

cur.execute(
    """
    SELECT COUNT(*)::int FROM public.factura_interna fi
    WHERE fi.estado IN ('RESERVADA', 'CONFIRMADA', 'ANULADA')
    """
)
total_fi = cur.fetchone()[0]

cur.execute(
    """
    SELECT COUNT(*)::int FROM public.factura_interna fi
    JOIN public.factura_interna_detalle fid ON fid.factura_id = fi.id
    WHERE fi.estado IN ('RESERVADA', 'CONFIRMADA', 'ANULADA')
    """
)
total_lineas = cur.fetchone()[0]

cur.execute(
    """
    SELECT fi.estado, COUNT(*)::int
    FROM public.factura_interna fi
    WHERE fi.estado = 'CONFIRMADA' AND fi.fecha_confirmacion IS NULL
    GROUP BY fi.estado
    """
)
huérfanas = cur.fetchall()

print(f"OK schema | FI exportables: {total_fi} | líneas CSV (detalle): {total_lineas}")
if huérfanas:
    print("WARN CONFIRMADA sin fecha:", huérfanas)
else:
    print("OK: todas las CONFIRMADA tienen fecha_confirmacion")

cur.close()
conn.close()
