import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

print("=" * 70)
print("DIAGNOSTICO LOGIN HECTOR - TABLET BAZZAR")
print("=" * 70)

# Buscar HECTOR en funcionarios
cur.execute("""
    SELECT id_funcionario, nombre_completo, ci, departamento, cargo
    FROM funcionarios
    WHERE nombre_completo ILIKE '%HECTOR%SEGOVIA%'
""")
row = cur.fetchone()

if row:
    print(f"\nFuncionario encontrado:")
    print(f"  ID: {row[0]}")
    print(f"  Nombre: {row[1]}")
    print(f"  CI: {row[2]}")
    print(f"  Departamento: {row[3]}")
    print(f"  Cargo: {row[4]}")

    # Buscar en usuarios (si existe tabla usuarios para login)
    try:
        cur.execute("SELECT * FROM usuarios WHERE funcionario_id = %s OR username ILIKE 'HECTOR'", (row[0],))
        usuario = cur.fetchone()
        if usuario:
            print(f"\n  Usuario encontrado: {usuario}")
        else:
            print("\n  ❌ NO TIENE USUARIO CREADO en tabla usuarios")
    except Exception as e:
        print(f"\n  Tabla usuarios no existe o error: {e}")
else:
    print("❌ Funcionario HECTOR no encontrado")

# Verificar si existe tabla de autenticación para tablet
try:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%auth%' OR table_name LIKE '%login%' OR table_name LIKE '%usuario%'")
    tablas = cur.fetchall()
    print(f"\n\nTablas de autenticación encontradas:")
    for t in tablas:
        print(f"  - {t[0]}")
except Exception as e:
    print(f"Error: {e}")

conn.close()
