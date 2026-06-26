"""
Corrige rol_id y ente_id de usuarios tienda BZZ* en usuario_v2.

Matriz: BZZ* = rol_id 2 (BAZZAR), ente 2–4 según sede F/S/P.
BZZF legacy → Fernando (ente 2).
"""
from __future__ import annotations

import os
import re
import sys

import psycopg2
from dotenv import load_dotenv

SEDE_ENTE = {"F": 2, "S": 3, "P": 4}


def inferir_ente_codigo(usuario: str) -> int | None:
    u = usuario.strip().upper()
    if u == "BZZF":
        return 2
    m = re.match(r"^BZZ([FSP])", u)
    return SEDE_ENTE.get(m.group(1)) if m else None


def main() -> int:
    load_dotenv(".env.local")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL no definida en report/.env.local")
        return 1

    dry = "--dry-run" in sys.argv
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.ente_id, e.codigo
        FROM usuario_v2 u
        LEFT JOIN entes e ON e.id_ente = u.ente_id
        WHERE UPPER(TRIM(u.descp_usuario)) LIKE 'BZZ%'
        ORDER BY u.descp_usuario
        """
    )
    rows = cur.fetchall()
    print("=" * 72)
    print(f"USUARIOS BZZ* ({len(rows)} filas)")
    print("=" * 72)

    fixes = 0
    for uid, descp, rol_id, cat, ente_id, ente_cod in rows:
        descp_s = str(descp).strip()
        target_rol = 2 if int(rol_id or 0) in (1, 3) else int(rol_id or 0)
        target_ente_cod = inferir_ente_codigo(descp_s)
        needs_rol = int(rol_id or 0) != target_rol
        needs_ente = target_ente_cod is not None and int(ente_cod or 0) != target_ente_cod

        print(f"\n{descp_s} (id={uid}) cat={cat} rol={rol_id} ente={ente_cod}")
        if needs_rol:
            print(f"  → rol_id {rol_id} → {target_rol}")
        if needs_ente:
            print(f"  → ente cod {ente_cod} → {target_ente_cod}")

        if not needs_rol and not needs_ente:
            print("  ok")
            continue

        fixes += 1
        if dry:
            continue

        new_ente_id = ente_id
        if needs_ente and target_ente_cod is not None:
            cur.execute("SELECT id_ente FROM entes WHERE codigo = %s", (target_ente_cod,))
            er = cur.fetchone()
            if er:
                new_ente_id = er[0]

        cur.execute(
            "UPDATE usuario_v2 SET rol_id = %s, ente_id = %s WHERE id_usuario = %s",
            (target_rol, new_ente_id, uid),
        )

    if not dry and fixes:
        conn.commit()
        print(f"\n✅ {fixes} usuario(s) corregido(s).")
    elif dry:
        print(f"\n(dry-run — {fixes} pendiente(s))")
    else:
        print("\nSin cambios necesarios.")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
