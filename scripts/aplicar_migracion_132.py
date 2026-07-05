"""Aplica migración 132 — funcionarios.id_cliente → cliente_v2."""
import os
import sys

import psycopg2
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATION = os.path.join(
    ROOT, "..", "control_central", "migrations", "132_funcionario_cliente_v2.sql",
)

load_dotenv(os.path.join(ROOT, ".env.local"))
url = os.getenv("DATABASE_URL")
if not url:
    print("ERROR: DATABASE_URL no encontrada")
    sys.exit(1)

with open(os.path.normpath(MIGRATION), encoding="utf-8") as f:
    sql = f.read()

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
try:
    cur.execute(sql)
    print("OK: migración 132 — funcionarios.id_cliente → cliente_v2")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()
