"""Aplica migración 131 — ente principal usuario + punto RRHH."""
import os
import sys

import psycopg2
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATION = os.path.join(
    ROOT,
    "..",
    "control_central",
    "migrations",
    "131_ente_principal_usuario_punto_rrhh.sql",
)

load_dotenv(os.path.join(ROOT, ".env.local"))
url = os.getenv("DATABASE_URL")
if not url:
    print("ERROR: DATABASE_URL no encontrada en .env.local")
    sys.exit(1)

with open(os.path.normpath(MIGRATION), encoding="utf-8") as f:
    sql = f.read()

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
try:
    cur.execute(sql)
    print("OK: migración 131 — ente principal + punto_ente_id RRHH")
    cur.execute(
        """
        SELECT codigo, nombre, cliente_id
        FROM entes WHERE activo = true ORDER BY codigo
        """
    )
    print("\n=== entes ===")
    for row in cur.fetchall():
        cli = f" cli={row[2]}" if row[2] else " (principal)"
        print(f"  {row[0]} · {row[1]}{cli}")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()
