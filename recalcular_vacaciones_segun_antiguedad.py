"""
Recalcular días de vacaciones según antigüedad y legislación paraguaya

Legislación:
- 1 a 5 años: 12 días hábiles
- 5 a 10 años: 18 días hábiles
- Más de 10 años: 30 días hábiles
"""

import psycopg2
from dotenv import load_dotenv
import os

load_dotenv(".env.local")

def calcular_dias_legales(antiguedad_anios):
    """Calcular días según legislación paraguaya"""
    if antiguedad_anios is None:
        return 12  # Default para sin antigüedad
    if antiguedad_anios >= 10:
        return 30
    if antiguedad_anios >= 5:
        return 18
    return 12

def main():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL no configurada")
        return

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("=" * 70)
    print("RECALCULAR VACACIONES SEGÚN ANTIGÜEDAD")
    print("=" * 70)

    # Obtener todos los funcionarios con sus vacaciones 2026
    cur.execute("""
        SELECT
            f.id_funcionario,
            f.nombre_completo,
            f.antiguedad_anios,
            f.antiguedad_meses,
            v.id_vacacion,
            v.dias_totales AS dias_actuales,
            v.dias_tomados
        FROM funcionarios f
        LEFT JOIN vacaciones v ON v.funcionario_id = f.id_funcionario AND v.anio = 2026
        WHERE f.activo = true
        ORDER BY f.departamento, f.nombre_completo
    """)

    funcionarios = cur.fetchall()
    print(f"\n{len(funcionarios)} funcionarios encontrados\n")

    actualizados = 0
    sin_cambios = 0
    errores = 0

    for row in funcionarios:
        id_func, nombre, anios, meses, id_vac, dias_actuales, dias_tomados = row

        # Calcular días que corresponden según antigüedad
        dias_legales = calcular_dias_legales(anios)

        if id_vac is None:
            # No tiene registro de vacaciones 2026, crear uno
            try:
                cur.execute("""
                    INSERT INTO vacaciones (funcionario_id, anio, dias_totales, dias_tomados)
                    VALUES (%s, 2026, %s, 0)
                """, (id_func, dias_legales))
                print(f"  + CREADO: {nombre} ({anios or 0}a {meses or 0}m) -> {dias_legales} días")
                actualizados += 1
            except Exception as e:
                print(f"  X ERROR creando {nombre}: {e}")
                errores += 1
        elif dias_actuales != dias_legales:
            # Actualizar si no coincide
            try:
                cur.execute("""
                    UPDATE vacaciones
                    SET dias_totales = %s
                    WHERE id_vacacion = %s
                """, (dias_legales, id_vac))
                print(f"  * ACTUALIZADO: {nombre} ({anios or 0}a {meses or 0}m) -> {dias_actuales} a {dias_legales} días")
                actualizados += 1
            except Exception as e:
                print(f"  X ERROR actualizando {nombre}: {e}")
                errores += 1
        else:
            sin_cambios += 1

    conn.commit()

    print("\n" + "=" * 70)
    print("RESUMEN")
    print("=" * 70)
    print(f"  Actualizados/Creados: {actualizados}")
    print(f"  Sin cambios: {sin_cambios}")
    print(f"  Errores: {errores}")
    print("=" * 70)

    # Mostrar algunos ejemplos
    print("\nEjemplos de asignaciones:")
    cur.execute("""
        SELECT
            f.nombre_completo,
            f.antiguedad_anios,
            f.antiguedad_meses,
            v.dias_totales,
            v.dias_tomados,
            v.dias_pendientes
        FROM funcionarios f
        INNER JOIN vacaciones v ON v.funcionario_id = f.id_funcionario AND v.anio = 2026
        ORDER BY f.antiguedad_anios DESC
        LIMIT 10
    """)

    ejemplos = cur.fetchall()
    for ej in ejemplos:
        nombre, anios, meses, total, tomados, pend = ej
        print(f"  {nombre}: {anios or 0}a {meses or 0}m -> {total} días totales ({pend} pendientes)")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
