import psycopg2
from dotenv import load_dotenv
import os

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

print("=" * 70)
print("HOTFIX URGENTE: LOGIN HECTOR TABLET BAZZAR")
print("=" * 70)

# 1. Verificar si existe tabla usuario_v2
try:
    cur.execute("SELECT * FROM usuario_v2 WHERE descp_usuario ILIKE 'HECTOR' OR descp_usuario ILIKE '%SEGOVIA%'")
    usuarios = cur.fetchall()

    if usuarios:
        print("\nUsuarios encontrados en usuario_v2:")
        for u in usuarios:
            print(f"  {u}")
    else:
        print("\n❌ HECTOR NO EXISTE en tabla usuario_v2")
        print("\nCreando usuario HECTOR con categoria DIOS...")

        # Buscar funcionario HECTOR
        cur.execute("SELECT id_funcionario, nombre_completo, ci FROM funcionarios WHERE nombre_completo ILIKE '%HECTOR%SEGOVIA%'")
        func = cur.fetchone()

        if func:
            print(f"  Funcionario: {func[1]} (ID: {func[0]}, CI: {func[2]})")

            # Crear usuario
            cur.execute("""
                INSERT INTO usuario_v2 (descp_usuario, email, password, rol_id, categoria, funcionario_id, activo)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id_usuario, descp_usuario, rol_id, categoria
            """, (
                'HECTOR',
                'hector@rimec.com',
                'qwerty2020',  # Contraseña temporal
                1,  # rol_id = 1 (acceso total)
                'DIOS',  # categoria DIOS
                func[0],  # funcionario_id
                True
            ))

            nuevo = cur.fetchone()
            conn.commit()

            print(f"\n✅ USUARIO CREADO:")
            print(f"  ID: {nuevo[0]}")
            print(f"  Usuario: {nuevo[1]}")
            print(f"  Rol: {nuevo[2]}")
            print(f"  Categoria: {nuevo[3]}")
            print(f"  Password: qwerty2020")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\nLa tabla usuario_v2 probablemente no existe.")
    print("Verificando tablas disponibles...")

    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%usuario%'
        ORDER BY table_name
    """)

    tablas = cur.fetchall()
    print("\nTablas de usuarios encontradas:")
    for t in tablas:
        print(f"  - {t[0]}")

cur.close()
conn.close()

print("\n" * 70)
