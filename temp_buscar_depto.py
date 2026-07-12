import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

nombres = ['GRACIELA%ROA%', 'EGIDIO%MAIDANA%', 'PATRICIA%MORA%', 'HECTOR%SEGOVIA%']

print("Buscando funcionarios...")
for nombre in nombres:
    cur.execute("SELECT nombre_completo, departamento, cargo, ci FROM funcionarios WHERE nombre_completo ILIKE %s", (nombre,))
    row = cur.fetchone()
    if row:
        print(f"{row[0]:<45} | {row[1]:<15} | {row[2]:<35} | CI: {row[3]}")
    else:
        print(f"No encontrado: {nombre}")

# Buscar todos del mismo departamento
print("\nTodos los funcionarios del departamento VENTAS:")
cur.execute("SELECT nombre_completo, cargo FROM funcionarios WHERE departamento = 'VENTAS' ORDER BY nombre_completo")
for row in cur.fetchall():
    print(f"  - {row[0]:<45} ({row[1]})")

conn.close()
