"""Aplica migración 130 — triada acceso holding (Ente × Rol × Categoría)."""
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
    "130_triada_acceso_holding.sql",
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
    print("OK: migración 130 aplicada — triada acceso holding")
    cur.execute(
        """
        SELECT r.id, r.nivel, r.nombre_rol FROM maestro_rol_acceso r ORDER BY r.nivel
        """
    )
    print("\n=== Roles orgánicos ===")
    for row in cur.fetchall():
        print(f"  id={row[0]} nivel={row[1]} · {row[2]}")
    cur.execute(
        """
        SELECT nivel, codigo FROM usuario_categoria ORDER BY nivel
        """
    )
    print("\n=== Categorías ===")
    for row in cur.fetchall():
        print(f"  nivel={row[0]} · {row[1]}")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()
