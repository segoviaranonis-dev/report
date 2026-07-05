from pathlib import Path

import openpyxl
import psycopg2

env = Path(r"c:\Users\hecto\Nexus_Core\report\.env.local").read_text(encoding="utf-8")
url = next(l.split("=", 1)[1].strip().strip('"') for l in env.splitlines() if l.startswith("DATABASE_URL="))

wb = openpyxl.load_workbook(r"c:\Users\hecto\Nexus_Core\color.xlsx", read_only=True, data_only=True)
ws = wb.active
xlsx = set()
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[0] is None:
        continue
    xlsx.add(int(float(r[0])))
wb.close()

conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("SELECT codigo_proveedor::bigint FROM color WHERE proveedor_id=654 AND activo=true")
db = {r[0] for r in cur.fetchall()}
conn.close()

print("xlsx", len(xlsx), "db", len(db))
print("xlsx_not_in_db", len(xlsx - db))
print("db_not_in_xlsx", len(db - xlsx))
print("sample xlsx_not_in_db", sorted(xlsx - db)[:10])
print("sample db_not_in_xlsx", sorted(db - xlsx)[:10])
