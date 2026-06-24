"""Desglose por linea -> marca aproximada para sdfm3316."""
import csv
from collections import defaultdict

LINEA_MARCA = {
    "1214": ("VIZZANO", 2),
    "1220": ("VIZZANO", 2),
    "9091": ("BEIRA RIO", 1),
    "3105": ("VIZZANO", 2),
    "7401": ("MODARE", 3),
    "5346": ("MOLECA", 4),
    "2136": ("MOLEKINHO", 6),
    "2140": ("MOLEKINHO", 6),
    "2574": ("MOLEKINHA", 5),
    "2831": ("MOLEKINHO", 6),
    "4202": ("ACTVITTA", 7),
    "4929": ("ACTVITTA", 7),
    "2274": ("BR SPORT", 8),
}

DEST = [
    ("S00_D1", "deposito_1_2100_tienda", 2100, "Adultos tienda"),
    ("S00_D2", "deposito_2_2100_guardado", 2100, "Adultos guardado"),
    ("S00_NINHOS", "deposito_1_2900_tienda", 2900, "Niños tienda"),
]

rows = list(csv.DictReader(open(r"C:\Users\hecto\Nexus_Core\sdfm3316.csv", encoding="latin-1"), delimiter=";"))

def q(row, c):
    try: return int((row.get(c) or "0").strip() or 0)
    except: return 0

def lr(s):
    s = s.strip()
    if "-" in s:
        a,b = s.split("-",1)
        return a.strip()
    return s

# marca_id -> dest tabla -> unidades
by_marca = defaultdict(lambda: defaultdict(int))
by_marca_filas = defaultdict(lambda: defaultdict(int))

for row in rows:
    linea = lr(row["COD.ART.PROVEEDOR"])
    marca, mid = LINEA_MARCA.get(linea, (f"L{linea}", 0))
    key = f"{mid}:{marca}"
    for col, tabla, cid, label in DEST:
        qty = q(row, col)
        if qty <= 0: continue
        by_marca[key][tabla] += qty
        by_marca_filas[key][tabla] += 1

print("| id_marca | Marca | deposito_1_2100_tienda | deposito_2_2100_guardado | deposito_1_2900_tienda | TOTAL u. | Filas |")
print("|----------|-------|----------------------:|-------------------------:|-----------------------:|---------:|------:|")
for key in sorted(by_marca.keys(), key=lambda k: int(k.split(":")[0]) if k.split(":")[0].isdigit() else 99):
    mid, marca = key.split(":", 1)
    t1 = by_marca[key]["deposito_1_2100_tienda"]
    t2 = by_marca[key]["deposito_2_2100_guardado"]
    t3 = by_marca[key]["deposito_1_2900_tienda"]
    filas = sum(by_marca_filas[key].values())
    print(f"| {mid} | {marca} | {t1} | {t2} | {t3} | **{t1+t2+t3}** | {filas} |")
