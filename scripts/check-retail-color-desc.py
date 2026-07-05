from pathlib import Path

import psycopg2

env = Path(r"c:\Users\hecto\Nexus_Core\report\.env.local").read_text(encoding="utf-8")
url = next(l.split("=", 1)[1].strip().strip('"') for l in env.splitlines() if l.startswith("DATABASE_URL="))
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    """
    SELECT c.codigo_proveedor::text,
           NULLIF(btrim(s.excel_color_desc::text), '') AS excel_desc,
           NULLIF(btrim(s.descp_color::text), '') AS descp
    FROM color c
    LEFT JOIN LATERAL (
      SELECT excel_color_desc, descp_color
      FROM registro_st_vt_rc_reposicion s
      WHERE s.color_id = c.id
      LIMIT 1
    ) s ON true
    WHERE c.proveedor_id = 654 AND c.activo = true
      AND (c.nombre IS NULL OR btrim(c.nombre) = '')
    LIMIT 15
    """
)
for r in cur.fetchall():
    print(r)
cur.execute(
    """
    SELECT COUNT(*) FROM color c
    WHERE c.proveedor_id = 654 AND c.activo = true
      AND (c.nombre IS NULL OR btrim(c.nombre) = '')
      AND EXISTS (
        SELECT 1 FROM registro_st_vt_rc_reposicion s
        WHERE s.color_id = c.id
          AND (
            (s.excel_color_desc IS NOT NULL AND btrim(s.excel_color_desc::text) <> '')
            OR (s.descp_color IS NOT NULL AND btrim(s.descp_color::text) <> '')
          )
      )
    """
)
print("empty_with_retail_desc", cur.fetchone()[0])
conn.close()
