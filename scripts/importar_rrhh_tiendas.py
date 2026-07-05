"""
Importa funcionarios de tiendas Bazzar desde FUNCIONARIOS.xlsx → tabla funcionarios (RRHH).
"""
from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import psycopg2
from dotenv import load_dotenv

EXCEL_PATH = Path(r"C:\Users\hecto\Nexus_Core\FUNCIONARIOS.xlsx")

ENTE_MAP = {
    "FERNANDO": 2,
    "SAN MARTIN": 3,
    "SAN MARTÍN": 3,
    "PALMA": 4,
}

CARGO_MAP = {
    1: "GERENTE",
    2: "Administrador",
    3: "Vendedor",
}


def limpiar_ci(ci_raw) -> str:
    return str(int(float(ci_raw))) if pd.notna(ci_raw) else ""


def calcular_antiguedad(fecha_ingreso: date, hoy: date) -> tuple[int, int]:
    anios = hoy.year - fecha_ingreso.year
    meses = hoy.month - fecha_ingreso.month
    if hoy.day < fecha_ingreso.day:
        meses -= 1
    if meses < 0:
        anios -= 1
        meses += 12
    return anios, meses


def to_date(val) -> date | None:
    if pd.isna(val):
        return None
    return pd.Timestamp(val).date()


def main() -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL no definido en report/.env.local")
        return 1

    if not EXCEL_PATH.is_file():
        print(f"ERROR: no existe {EXCEL_PATH}")
        return 1

    df = pd.read_excel(EXCEL_PATH)
    print(f"Leyendo {EXCEL_PATH.name}: {len(df)} filas")

    hoy = date.today()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    insertados = 0
    actualizados = 0
    errores = 0

    sql = """
        INSERT INTO funcionarios (
            ente_id, id_cliente, nombres, apellidos, ci, sexo,
            fecha_nacimiento, departamento, cargo, item,
            fecha_ingreso_ips, antiguedad_anios, antiguedad_meses, activo
        ) VALUES (
            %(ente_id)s, %(id_cliente)s, %(nombres)s, %(apellidos)s, %(ci)s, %(sexo)s,
            %(fecha_nacimiento)s, %(departamento)s, %(cargo)s, %(item)s,
            %(fecha_ingreso_ips)s, %(antiguedad_anios)s, %(antiguedad_meses)s, true
        )
        ON CONFLICT (ci) DO UPDATE SET
            ente_id = EXCLUDED.ente_id,
            id_cliente = EXCLUDED.id_cliente,
            nombres = EXCLUDED.nombres,
            apellidos = EXCLUDED.apellidos,
            sexo = EXCLUDED.sexo,
            fecha_nacimiento = EXCLUDED.fecha_nacimiento,
            departamento = EXCLUDED.departamento,
            cargo = EXCLUDED.cargo,
            item = EXCLUDED.item,
            fecha_ingreso_ips = EXCLUDED.fecha_ingreso_ips,
            antiguedad_anios = EXCLUDED.antiguedad_anios,
            antiguedad_meses = EXCLUDED.antiguedad_meses,
            activo = true,
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
    """

    for idx, row in df.iterrows():
        try:
            ente_key = str(row["ENTE"]).strip().upper()
            ente_id = ENTE_MAP.get(ente_key)
            if ente_id is None:
                raise ValueError(f"ENTE desconocido: {row['ENTE']!r}")

            rol = int(row["ROL"])
            cargo = CARGO_MAP.get(rol)
            if cargo is None:
                raise ValueError(f"ROL inválido: {rol}")

            fecha_ips = to_date(row["ENTRADA IPS"])
            if fecha_ips is None:
                raise ValueError("ENTRADA IPS vacía")

            anios, meses = calcular_antiguedad(fecha_ips, hoy)
            ci = limpiar_ci(row["N.º CEDULA"])

            datos = {
                "ente_id": ente_id,
                "id_cliente": int(row["LOCAL"]),
                "nombres": str(row["NOMBRES"]).strip(),
                "apellidos": str(row["APELLIDOS"]).strip(),
                "ci": ci,
                "sexo": str(row["SEXO"]).strip(),
                "fecha_nacimiento": to_date(row["FCHA. DE NACIMIENTO"]),
                "departamento": "VENTAS",
                "cargo": cargo,
                "item": int(row["CODIG.DE VENDEDOR"]),
                "fecha_ingreso_ips": fecha_ips,
                "antiguedad_anios": anios,
                "antiguedad_meses": meses,
            }

            cur.execute(sql, datos)
            inserted = cur.fetchone()[0]
            if inserted:
                insertados += 1
                accion = "INSERT"
            else:
                actualizados += 1
                accion = "UPDATE"

            print(f"[{idx + 1}/{len(df)}] {accion} {datos['nombres']} {datos['apellidos']} (CI {ci})")

        except Exception as exc:
            errores += 1
            print(f"[{idx + 1}/{len(df)}] ERROR: {exc}")

    conn.commit()

    cur.execute(
        """
        SELECT e.nombre, COUNT(*)
        FROM funcionarios f
        JOIN entes e ON e.id_ente = f.ente_id
        GROUP BY e.nombre
        ORDER BY e.nombre
        """
    )
    print("\n--- Funcionarios por ente ---")
    for nombre, count in cur.fetchall():
        print(f"  {nombre}: {count}")

    cur.close()
    conn.close()

    print(f"\nResumen: {insertados} insertados, {actualizados} actualizados, {errores} errores")
    return 0 if errores == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
