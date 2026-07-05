"""Aplica migración 128 — columna entidad_holding en usuario_v2."""
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
    "128_usuario_entidad_holding.sql",
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
    print("OK: migración 128 — entidad_holding en usuario_v2")
    cur.execute(
        """
        SELECT entidad_holding, COUNT(*)::int
        FROM usuario_v2
        GROUP BY entidad_holding
        ORDER BY entidad_holding
        """
    )
    print("\n=== Distribución entidad_holding ===")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} usuarios")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()
