import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# Ver estructura de tabla usuario_v2
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'usuario_v2'
    ORDER BY ordinal_position
""")

print("Estructura tabla usuario_v2:")
for row in cur.fetchall():
    print(f"  {row[0]:<20} {row[1]}")

# Buscar HECTOR
cur.execute("""
    SELECT id_usuario, descp_usuario, categoria, password, password_hash, rol_id
    FROM usuario_v2
    WHERE descp_usuario ILIKE 'HECTOR'
""")

print("\nUsuario HECTOR:")
row = cur.fetchone()
if row:
    print(f"  ID: {row[0]}")
    print(f"  Usuario: {row[1]}")
    print(f"  Categoria: {row[2]}")
    print(f"  Password plaintext: {row[3]}")
    print(f"  Password hash: {row[4][:30]}..." if row[4] else "  Password hash: None")
    print(f"  Rol ID: {row[5]}")

conn.close()
