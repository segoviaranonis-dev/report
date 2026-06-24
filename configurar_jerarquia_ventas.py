"""
Configurar jerarquía organizacional VENTAS

Estructura:
1. GRACIELA (Gerente General)
   1.1 EGIDIO (Supervisor Calzados)
   1.2 PATRICIA (Supervisora Confecciones)
   1.3 HECTOR (Coordinador - responsable de los demás)
       1.3.1 ALFREDO
       1.3.2 ESTEBAN
       1.3.3 GUSTAVO
       1.3.4 IVAN
"""

import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

print("=" * 70)
print("CONFIGURAR JERARQUIA DEPARTAMENTO VENTAS")
print("=" * 70)

# 1. Gerente General
cur.execute("""
    UPDATE funcionarios
    SET jerarquia_organizacional = '1'
    WHERE ci = '866932' AND departamento = 'VENTAS'
""")
print("1. GRACIELA ROA -> nivel 1 (Gerente General)")

# 1.1 Supervisor Calzados
cur.execute("""
    UPDATE funcionarios
    SET jerarquia_organizacional = '1.1'
    WHERE ci = '4691074' AND departamento = 'VENTAS'
""")
print("   1.1 EGIDIO MAIDANA -> nivel 1.1 (Supervisor Calzados)")

# 1.2 Supervisora Confecciones
cur.execute("""
    UPDATE funcionarios
    SET jerarquia_organizacional = '1.2'
    WHERE ci = '2368036' AND departamento = 'VENTAS'
""")
print("   1.2 PATRICIA MORA -> nivel 1.2 (Supervisora Confecciones)")

# 1.3 Coordinador (responsable de auxiliares)
cur.execute("""
    UPDATE funcionarios
    SET jerarquia_organizacional = '1.3'
    WHERE ci = '3833142' AND departamento = 'VENTAS'
""")
print("   1.3 HECTOR SEGOVIA -> nivel 1.3 (Coordinador)")

# Subordinados de Héctor (auxiliares)
subordinados = [
    ('4666372', 'ALFREDO CABRERA', '1.3.1'),
    ('4996254', 'ESTEBAN CANDIA', '1.3.2'),
    ('4448129', 'GUSTAVO ASTORGA', '1.3.3'),
    ('5261483', 'IVAN GONZALEZ', '1.3.4'),
]

for ci, nombre, nivel in subordinados:
    cur.execute("""
        UPDATE funcionarios
        SET jerarquia_organizacional = %s
        WHERE ci = %s AND departamento = 'VENTAS'
    """, (nivel, ci))
    print(f"      {nivel} {nombre}")

conn.commit()

print("\n" + "=" * 70)
print("VERIFICACION")
print("=" * 70)

cur.execute("""
    SELECT
        jerarquia_organizacional,
        nombre_completo,
        cargo
    FROM funcionarios
    WHERE departamento = 'VENTAS'
    AND jerarquia_organizacional IS NOT NULL
    ORDER BY jerarquia_organizacional
""")

for row in cur.fetchall():
    nivel = row[0] or '(sin)'
    indent = '  ' * nivel.count('.')
    print(f"{indent}{nivel}  {row[1]} ({row[2]})")

cur.close()
conn.close()

print("\n" + "=" * 70)
print("JERARQUIA VENTAS CONFIGURADA EXITOSAMENTE")
print("=" * 70)
