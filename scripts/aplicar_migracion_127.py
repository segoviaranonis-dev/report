"""Aplica migración 127 — tabla usuario_categoria."""
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
    "127_usuario_categoria.sql",
)

load_dotenv(os.path.join(ROOT, ".env.local"))
url = os.getenv("DATABASE_URL")
if not url:
    print("ERROR: DATABASE_URL no encontrada en .env.local")
    sys.exit(1)

sql_path = os.path.normpath(MIGRATION)
with open(sql_path, encoding="utf-8") as f:
    sql = f.read()

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
try:
    cur.execute(sql)
    print("OK: migración 127 aplicada — usuario_categoria")
    cur.execute(
        """
        SELECT c.rol_id, r.nombre_rol, c.codigo, c.descripcion
        FROM usuario_categoria c
        JOIN maestro_rol_acceso r ON r.id = c.rol_id
        ORDER BY c.rol_id, c.codigo
        """
    )
    print("\n=== usuario_categoria (semilla) ===")
    for row in cur.fetchall():
        print(f"  rol_id={row[0]} ({row[1]}) · {row[2]} — {row[3]}")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()
