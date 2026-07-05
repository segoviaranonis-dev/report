"""
Sincroniza usuarios tienda BZZ: contraseña = número de depósito (cliente_id).

Regla holding: BZZSN → 2700, BZZPN → 3200, BZZFN → 2900, etc.
Escribe password (legacy Streamlit) + password_hash (bcrypt) coherentes.
"""
from __future__ import annotations

import os
import sys

import bcrypt
import psycopg2
from dotenv import load_dotenv

# BZZ + sede F/S/P + segmento A/N → cliente_id / contraseña
DEPOSITO_PASSWORD: dict[str, str] = {
    "BZZFA": "2100",
    "BZZFN": "2900",
    "BZZSA": "2400",
    "BZZSN": "2700",
    "BZZPA": "3100",
    "BZZPN": "3200",
}

ENTE_FIX: dict[str, int] = {
    "BZZSN": 3,  # San Martín (estaba en ente 1 RIMEC)
}


def main() -> int:
    load_dotenv(".env.local")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL no definida en report/.env.local")
        return 1

    dry = "--dry-run" in sys.argv
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("=" * 72)
    print("SINCRONIZAR PASSWORD BZZ = depósito")
    print("=" * 72)

    for usuario, pwd in DEPOSITO_PASSWORD.items():
        cur.execute(
            """
            SELECT id_usuario, password, password_hash, ente_id
            FROM usuario_v2
            WHERE UPPER(TRIM(descp_usuario)) = UPPER(TRIM(%s))
            """,
            (usuario,),
        )
        row = cur.fetchone()
        if not row:
            print(f"  SKIP {usuario} — no existe en usuario_v2")
            continue

        uid, pwd_col, pwd_hash, ente_id = row
        hash_new = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt(rounds=10)).decode()

        needs_pwd = pwd_col != pwd or str(pwd_col or "").startswith("__hash_")
        needs_hash = True
        if pwd_hash:
            needs_hash = not bcrypt.checkpw(pwd.encode(), pwd_hash.encode())

        ente_cod = ENTE_FIX.get(usuario.upper())
        needs_ente = ente_cod is not None

        print(f"\n{usuario} (id={uid})")
        print(f"  password col: {pwd_col!r} → {pwd!r}" if needs_pwd else f"  password col: ok ({pwd!r})")
        print(f"  password_hash: {'actualizar' if needs_hash else 'ok (bcrypt)'}")

        if needs_ente:
            cur.execute("SELECT id_ente FROM entes WHERE codigo = %s", (ente_cod,))
            ente_row = cur.fetchone()
            if ente_row:
                print(f"  ente_id: {ente_id} → {ente_row[0]} (codigo {ente_cod})")
            else:
                print(f"  WARN ente codigo {ente_cod} no encontrado")
                needs_ente = False

        if dry:
            continue

        if needs_pwd or needs_hash:
            cur.execute(
                """
                UPDATE usuario_v2
                SET password = %s, password_hash = %s
                WHERE id_usuario = %s
                """,
                (pwd, hash_new if needs_hash else pwd_hash, uid),
            )

        if needs_ente and ente_row:
            cur.execute(
                "UPDATE usuario_v2 SET ente_id = %s WHERE id_usuario = %s",
                (ente_row[0], uid),
            )

    if not dry:
        conn.commit()
        print("\n✅ Cambios aplicados.")
    else:
        print("\n(dry-run — sin cambios en BD)")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
