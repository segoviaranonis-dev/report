#!/usr/bin/env python3
"""Aplica MIG-114: fecha_confirmacion + trigger + índices."""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

url = os.getenv("DATABASE_URL")
if not url:
    print("FAIL: DATABASE_URL no encontrada en report/.env.local", file=sys.stderr)
    sys.exit(1)

sql_path = ROOT / "migrations" / "114_fi_fecha_confirmacion.sql"
sql = sql_path.read_text(encoding="utf-8")

print("MIG-114: fecha_confirmacion + trigger + índices…")

conn = psycopg2.connect(url)
conn.autocommit = False
cur = conn.cursor()
try:
    cur.execute(sql)
    conn.commit()
    print("OK: migración aplicada")

    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factura_interna'
          AND column_name = 'fecha_confirmacion'
        """
    )
    col = cur.fetchone()
    print(f"Columna: {col[0]} ({col[1]})" if col else "Columna: MISSING")

    cur.execute(
        "SELECT tgname FROM pg_trigger WHERE tgname = 'trg_fi_fecha_confirmacion'"
    )
    trig = cur.fetchone()
    print(f"Trigger: {trig[0]}" if trig else "Trigger: MISSING")

    cur.execute(
        """
        SELECT estado, COUNT(*)::int, COUNT(fecha_confirmacion)::int
        FROM public.factura_interna
        WHERE estado IN ('RESERVADA', 'CONFIRMADA', 'ANULADA')
        GROUP BY estado ORDER BY estado
        """
    )
    print("FI por estado (total, con_fecha):", cur.fetchall())

    cur.execute(
        """
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'factura_interna'
          AND (indexname LIKE 'idx_fi_%%confirm%%' OR indexname = 'idx_fi_aprobaciones_csv_sort')
        """
    )
    print("Índices:", [r[0] for r in cur.fetchall()])
except Exception as e:
    conn.rollback()
    print(f"FAIL: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    cur.close()
    conn.close()
