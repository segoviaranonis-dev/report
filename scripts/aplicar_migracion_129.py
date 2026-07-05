"""Aplica migración 129 — usuario_v2.ente_id → entes."""
import os
import sys

import psycopg2
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATION = os.path.join(ROOT, "..", "control_central", "migrations", "129_usuario_ente_id.sql")

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
    print("OK: migración 129 — usuario_v2.ente_id → entes")
    cur.execute(
        """
        SELECT e.codigo, e.nombre, e.cliente_id, COUNT(u.id_usuario)::int
        FROM entes e
        LEFT JOIN usuario_v2 u ON u.ente_id = e.id_ente
        GROUP BY e.id_ente, e.codigo, e.nombre, e.cliente_id
        ORDER BY e.codigo
        """
    )
    print("\n=== entes + usuarios ===")
    for row in cur.fetchall():
        cli = row[2] if row[2] is not None else "—"
        print(f"  {row[0]:>2} {row[1]:<28} cli={cli} · {row[3]} usuarios")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()
