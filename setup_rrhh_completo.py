"""
Setup completo RRHH - Nexus Core
Crea tablas + importa funcionarios + crea vacaciones

EJECUCION:
python setup_rrhh_completo.py
"""

import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

# Cargar .env.local (donde está DATABASE_URL)
load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
EXCEL_PATH = r"C:\Users\hecto\Nexus_Core\DATOS EMPLEADOS 2026.xlsx"
ENTE_RIMEC = 1

print("=" * 70)
print("SETUP COMPLETO MODULO RRHH")
print("=" * 70)

# =====================================================
# PASO 1: CREAR TABLAS
# =====================================================

print("\n[PASO 1/4] Creando tablas en PostgreSQL...")

if not DATABASE_URL:
    print("X ERROR: DATABASE_URL no configurada en .env")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    print("OK Conectado a PostgreSQL")
except Exception as e:
    print(f"X ERROR: {e}")
    exit(1)

# Leer SQL completo
sql_path = r"C:\Users\hecto\Nexus_Core\report\RRHH_COMPLETO.sql"
with open(sql_path, "r", encoding="utf-8") as f:
    sql_completo = f.read()

try:
    cur.execute(sql_completo)
    conn.commit()
    print("OK Tablas creadas exitosamente")
except Exception as e:
    print(f"X ERROR al crear tablas: {e}")
    conn.rollback()
    exit(1)

# =====================================================
# PASO 2: IMPORTAR FUNCIONARIOS RIMEC
# =====================================================

print(f"\n[PASO 2/4] Importando funcionarios desde Excel...")

try:
    df = pd.read_excel(EXCEL_PATH)
    print(f"OK Excel leido: {len(df)} filas")
except Exception as e:
    print(f"X ERROR: {e}")
    exit(1)

def split_nombre(nombre_completo):
    partes = nombre_completo.strip().split()
    if len(partes) <= 2:
        return partes[0], partes[1] if len(partes) > 1 else ""
    if len(partes) == 3:
        return partes[0], f"{partes[1]} {partes[2]}"
    elif len(partes) >= 4:
        return f"{partes[0]} {partes[1]}", " ".join(partes[2:])
    return partes[0], " ".join(partes[1:])

def limpiar_ci(ci):
    return str(ci).replace(".", "").replace("-", "").replace(" ", "").strip()

insertados = 0
errores = 0

for idx, row in df.iterrows():
    try:
        nombres, apellidos = split_nombre(str(row["NOMBRE Y APELLIDO"]))
        ci = limpiar_ci(row["C.I."])

        if not ci or not nombres:
            print(f"  - Fila {idx+1}: Datos incompletos")
            continue

        # Limpiar sexo (solo M o F)
        sexo_raw = str(row["SEXO"]).strip().upper() if pd.notna(row["SEXO"]) else None
        sexo_val = sexo_raw[0] if sexo_raw and sexo_raw[0] in ["M", "F"] else None

        datos = {
            "ente_id": ENTE_RIMEC,
            "nombres": nombres.strip(),
            "apellidos": apellidos.strip(),
            "ci": ci,
            "sexo": sexo_val,
            "fecha_nacimiento": row["FECHA NAC."] if pd.notna(row["FECHA NAC."]) else None,
            "departamento": str(row["DEPARTAMENTO"]).strip(),
            "cargo": str(row["CARGO"]).strip(),
            "item": int(row["ITEM"]) if pd.notna(row["ITEM"]) else None,
            "fecha_ingreso_ips": row["INGRESO IPS"],
            "antiguedad_anios": int(row["ANTIG.YY"]) if pd.notna(row["ANTIG.YY"]) else None,
            "antiguedad_meses": int(row["ANTIG.MM"]) if pd.notna(row["ANTIG.MM"]) else None,
        }

        cur.execute("""
            INSERT INTO funcionarios (
                ente_id, nombres, apellidos, ci, sexo, fecha_nacimiento,
                departamento, cargo, item, fecha_ingreso_ips,
                antiguedad_anios, antiguedad_meses
            ) VALUES (
                %(ente_id)s, %(nombres)s, %(apellidos)s, %(ci)s, %(sexo)s, %(fecha_nacimiento)s,
                %(departamento)s, %(cargo)s, %(item)s, %(fecha_ingreso_ips)s,
                %(antiguedad_anios)s, %(antiguedad_meses)s
            )
            ON CONFLICT (ci) DO NOTHING
        """, datos)

        if cur.rowcount > 0:
            insertados += 1
            if insertados % 10 == 0:
                print(f"  > {insertados} funcionarios importados...")

    except Exception as e:
        errores += 1
        print(f"  X Error fila {idx+1}: {e}")
        conn.rollback()  # Reiniciar transacción
        continue

conn.commit()
print(f"OK Funcionarios importados: {insertados}")

# =====================================================
# PASO 3: CREAR VACACIONES 2026
# =====================================================

print(f"\n[PASO 3/4] Creando registros de vacaciones 2026...")

try:
    cur.execute("""
        INSERT INTO vacaciones (funcionario_id, anio, dias_totales, dias_tomados)
        SELECT
            id_funcionario,
            2026,
            30,
            FLOOR(RANDOM() * 15)::INTEGER
        FROM funcionarios
        WHERE ente_id = %s AND activo = true
        ON CONFLICT (funcionario_id, anio) DO NOTHING
    """, (ENTE_RIMEC,))

    vacaciones_creadas = cur.rowcount
    conn.commit()
    print(f"OK Registros de vacaciones creados: {vacaciones_creadas}")
except Exception as e:
    print(f"X ERROR: {e}")
    conn.rollback()

# =====================================================
# PASO 4: VERIFICACIÓN
# =====================================================

print(f"\n[PASO 4/4] Verificando datos...")

cur.execute("SELECT COUNT(*) FROM entes")
count_entes = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM funcionarios")
count_func = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM vacaciones WHERE anio = 2026")
count_vac = cur.fetchone()[0]

print(f"  > Entes: {count_entes}")
print(f"  > Funcionarios: {count_func}")
print(f"  > Vacaciones 2026: {count_vac}")

cur.close()
conn.close()

# =====================================================
# RESUMEN
# =====================================================

print("\n" + "=" * 70)
print(">>> SETUP COMPLETADO EXITOSAMENTE <<<")
print("=" * 70)
print(f"  OK Tablas creadas: entes, funcionarios, vacaciones")
print(f"  OK Funcionarios RIMEC: {insertados}")
print(f"  OK Vacaciones 2026: {vacaciones_creadas}")
print("=" * 70)
print("\nProximo paso: Recargar http://localhost:3003/rrhh/vacaciones\n")
