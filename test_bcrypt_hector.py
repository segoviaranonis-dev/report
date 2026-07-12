import bcrypt
import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# Obtener hash de HECTOR
cur.execute("SELECT password, password_hash FROM usuario_v2 WHERE descp_usuario = 'HECTOR'")
row = cur.fetchone()

password_plain = row[0]
password_hash = row[1]

print("=" * 70)
print("TEST BCRYPT - HECTOR")
print("=" * 70)
print(f"\nPassword plaintext en BD: '{password_plain}'")
print(f"Password hash en BD: {password_hash}")

# Probar diferentes contraseñas
passwords_to_test = [
    'todotodito',
    'TODOTODITO',
    password_plain,
    password_plain.strip(),
    'qwerty2020',
    'HECTOR',
]

print("\n" + "=" * 70)
print("PRUEBAS DE VERIFICACION")
print("=" * 70)

for pwd in passwords_to_test:
    try:
        # Test normal
        result = bcrypt.checkpw(pwd.encode('utf-8'), password_hash.encode('utf-8'))
        print(f"\n'{pwd}'")
        if result:
            print(f"  MATCH - SI FUNCIONA")
        else:
            print(f"  NO MATCH")

        # Test con \n (legacy)
        if not result:
            result_legacy = bcrypt.checkpw(f"{pwd}\n".encode('utf-8'), password_hash.encode('utf-8'))
            if result_legacy:
                print(f"  MATCH CON \\n (legacy)")
    except Exception as e:
        print(f"\n'{pwd}': ERROR - {e}")

conn.close()

print("\n" + "=" * 70)
