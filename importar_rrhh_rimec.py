"""
Script de importación de funcionarios RIMEC desde Excel
Proyecto: Report (rimec-report)
Fecha: 2026-06-13

PREREQUISITO:
1. Ejecutar primero rrhh_schema.sql en Supabase para crear las tablas
2. Tener archivo Excel: C:\Users\hecto\Nexus_Core\DATOS EMPLEADOS 2026.xlsx

EJECUCIÓN:
python importar_rrhh_rimec.py
"""

import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
EXCEL_PATH = r"C:\Users\hecto\Nexus_Core\DATOS EMPLEADOS 2026.xlsx"
DATABASE_URL = os.getenv("DATABASE_URL")
ENTE_ID_RIMEC = 1  # RIMEC código 1


def split_nombre_apellido(nombre_completo: str) -> tuple[str, str]:
    """
    Split 'Nombre Y Apellido' en nombres y apellidos.
    Heurística: primeras 1-2 palabras = nombres, resto = apellidos
    """
    partes = nombre_completo.strip().split()

    if len(partes) <= 2:
        return partes[0], partes[1] if len(partes) > 1 else ""

    # Si 3 palabras: primera = nombre, resto = apellidos
    if len(partes) == 3:
        nombres = partes[0]
        apellidos = f"{partes[1]} {partes[2]}"
    # Si 4+ palabras: primeras 2 = nombres, resto = apellidos
    elif len(partes) >= 4:
        nombres = f"{partes[0]} {partes[1]}"
        apellidos = " ".join(partes[2:])
    else:
        nombres = partes[0]
        apellidos = " ".join(partes[1:])

    return nombres, apellidos


def limpiar_ci(ci: any) -> str:
    """Limpia CI: quita puntos, guiones, espacios."""
    return str(ci).replace(".", "").replace("-", "").replace(" ", "").strip()


def importar_funcionarios():
    """Importa funcionarios desde Excel a PostgreSQL."""

    print("=" * 60)
    print("IMPORTACIÓN FUNCIONARIOS RIMEC")
    print("=" * 60)

    # 1. Leer Excel
    print(f"\n[1/4] Leyendo Excel: {EXCEL_PATH}")
    try:
        df = pd.read_excel(EXCEL_PATH)
        print(f"✓ Excel leído correctamente")
        print(f"  Filas: {len(df)}")
        print(f"  Columnas: {list(df.columns)}")
    except FileNotFoundError:
        print(f"✗ ERROR: No se encuentra el archivo Excel en {EXCEL_PATH}")
        return
    except Exception as e:
        print(f"✗ ERROR al leer Excel: {e}")
        return

    # 2. Conectar a base de datos
    print(f"\n[2/4] Conectando a PostgreSQL...")
    if not DATABASE_URL:
        print("✗ ERROR: DATABASE_URL no configurada en .env")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        print("✓ Conexión exitosa")
    except Exception as e:
        print(f"✗ ERROR al conectar: {e}")
        return

    # 3. Verificar que existe tabla entes y RIMEC
    print(f"\n[3/4] Verificando tabla entes...")
    try:
        cur.execute("SELECT id_ente, nombre FROM entes WHERE codigo = %s", (ENTE_ID_RIMEC,))
        ente = cur.fetchone()
        if not ente:
            print(f"✗ ERROR: No existe ente con código {ENTE_ID_RIMEC}")
            print("  → Ejecutar primero rrhh_schema.sql")
            return
        print(f"✓ Ente encontrado: {ente[1]} (id_ente={ente[0]})")
    except Exception as e:
        print(f"✗ ERROR: {e}")
        print("  → Verificar que se ejecutó rrhh_schema.sql")
        return

    # 4. Importar funcionarios
    print(f"\n[4/4] Importando {len(df)} funcionarios...")
    insertados = 0
    errores = 0
    skipped = 0

    for idx, row in df.iterrows():
        try:
            # Split nombre
            nombre_completo = str(row["NOMBRE Y APELLIDO"]).strip()
            nombres, apellidos = split_nombre_apellido(nombre_completo)

            # Limpiar CI
            ci = limpiar_ci(row["C.I."])

            # Validar datos mínimos
            if not ci or not nombres or not apellidos:
                print(f"  ⊘ Fila {idx+1}: Datos incompletos, saltando")
                skipped += 1
                continue

            # Preparar datos
            datos = {
                "ente_id": ENTE_ID_RIMEC,
                "nombres": nombres.strip(),
                "apellidos": apellidos.strip(),
                "ci": ci,
                "sexo": str(row["SEXO"]).strip() if pd.notna(row["SEXO"]) else None,
                "fecha_nacimiento": row["FECHA NAC."] if pd.notna(row["FECHA NAC."]) else None,
                "departamento": str(row["DEPARTAMENTO"]).strip(),
                "cargo": str(row["CARGO"]).strip(),
                "item": int(row["ITEM"]) if pd.notna(row["ITEM"]) else None,
                "fecha_ingreso_ips": row["INGRESO IPS"],
                "antiguedad_anios": int(row["ANTIG.YY"]) if pd.notna(row["ANTIG.YY"]) else None,
                "antiguedad_meses": int(row["ANTIG.MM"]) if pd.notna(row["ANTIG.MM"]) else None,
            }

            # INSERT
            cur.execute(
                """
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
            """,
                datos,
            )

            if cur.rowcount > 0:
                insertados += 1
                print(f"  ✓ [{idx+1}/{len(df)}] {nombres} {apellidos} (CI: {ci})")
            else:
                skipped += 1
                print(f"  ⊘ [{idx+1}/{len(df)}] {nombre_completo} (CI duplicado)")

        except Exception as e:
            errores += 1
            print(f"  ✗ ERROR fila {idx+1}: {e}")

    # Commit
    print(f"\n[COMMIT] Guardando cambios...")
    conn.commit()
    cur.close()
    conn.close()

    # Resumen
    print("\n" + "=" * 60)
    print("RESUMEN DE IMPORTACIÓN")
    print("=" * 60)
    print(f"  ✓ Insertados:  {insertados}")
    print(f"  ⊘ Saltados:    {skipped}")
    print(f"  ✗ Errores:     {errores}")
    print(f"  📊 Total:       {len(df)}")
    print("=" * 60)

    if insertados > 0:
        print(f"\n✓ Importación exitosa: {insertados} funcionarios en base de datos")
    else:
        print(f"\n⚠ No se insertaron funcionarios nuevos")


if __name__ == "__main__":
    importar_funcionarios()
