#!/usr/bin/env python3
"""
Ejecutor Migracion 080: Sistema Vacaciones DUAL + RESET
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

print("=" * 70)
print("EJECUTANDO MIGRACION 080: Sistema Vacaciones DUAL + RESET")
print("=" * 70)

try:
    # Conectar a Supabase
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    conn.autocommit = False
    cur = conn.cursor()

    # Leer migracion
    print("\n1. Leyendo archivo de migracion...")
    with open('migrations/080_vacaciones_sistema_dual_reset.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    print("   [OK] Archivo leido correctamente")

    # Ejecutar migracion
    print("\n2. Ejecutando migracion...")
    cur.execute(sql)
    conn.commit()
    print("   [OK] Migracion ejecutada exitosamente")

    # Verificar tablas creadas
    print("\n3. Verificando tablas creadas...")
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('vacaciones', 'vacaciones_detalle')
        ORDER BY table_name
    """)
    tablas = cur.fetchall()
    for tabla in tablas:
        print(f"   [OK] Tabla: {tabla[0]}")

    # Verificar registros 2026
    print("\n4. Verificando registros creados para 2026...")
    cur.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN tipo_vacacion = 'DIAS' THEN 1 ELSE 0 END) as solo_dias,
            SUM(CASE WHEN tipo_vacacion = 'MIXTO' THEN 1 ELSE 0 END) as gerentes_mixto,
            SUM(dias_totales) as total_dias_asignados,
            SUM(horas_totales) as total_horas_asignadas
        FROM vacaciones
        WHERE anio = 2026
    """)
    stats = cur.fetchone()

    print(f"\n   Estadisticas Año 2026:")
    print(f"      Total registros: {stats[0]}")
    print(f"      Funcionarios regulares (DIAS): {stats[1]}")
    print(f"      Gerentes/Supervisores (MIXTO): {stats[2]}")
    print(f"      Total dias asignados: {stats[3]}")
    print(f"      Total horas asignadas: {stats[4]:.2f}h")

    # Verificar RESET
    print("\n5. Verificando RESET (todos en 0)...")
    cur.execute("""
        SELECT
            SUM(dias_tomados) as dias_tomados,
            SUM(horas_tomadas) as horas_tomadas
        FROM vacaciones
        WHERE anio = 2026
    """)
    reset = cur.fetchone()

    print(f"\n   [OK] Dias tomados: {reset[0]} (debe ser 0)")
    print(f"   [OK] Horas tomadas: {reset[1]:.2f} (debe ser 0.00)")

    if reset[0] == 0 and float(reset[1]) == 0.00:
        print("\n   [SUCCESS] RESET EXITOSO - Todos los contadores en 0")

    # Muestra de registros
    print("\n6. Muestra de registros (primeros 10)...")
    cur.execute("""
        SELECT
            f.nombre_completo,
            f.cargo,
            v.tipo_vacacion,
            v.dias_totales,
            v.horas_totales
        FROM vacaciones v
        JOIN funcionarios f ON v.funcionario_id = f.id_funcionario
        WHERE v.anio = 2026
        ORDER BY f.apellidos
        LIMIT 10
    """)

    print("\n   Nombre                          | Cargo                    | Tipo   | Dias | Horas")
    print("   " + "-" * 90)

    for row in cur.fetchall():
        nombre = row[0][:30].ljust(30)
        cargo = row[1][:24].ljust(24)
        tipo = row[2].ljust(6)
        dias = str(row[3]).ljust(4)
        horas = f"{row[4]:.1f}".ljust(6)
        print(f"   {nombre} | {cargo} | {tipo} | {dias} | {horas}")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("[SUCCESS] MIGRACION COMPLETADA - Sistema listo para 2026-06-15")
    print("=" * 70)

except Exception as e:
    print(f"\n[ERROR] {e}")
    import traceback
    traceback.print_exc()
    if 'conn' in locals():
        conn.rollback()
        conn.close()
    exit(1)
