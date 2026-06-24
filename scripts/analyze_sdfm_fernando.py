import csv
from collections import Counter, defaultdict

path = r"C:\Users\hecto\Nexus_Core\sdfm3316.csv"
rows = []
with open(path, encoding="latin-1") as f:
    for row in csv.DictReader(f, delimiter=";"):
        rows.append({k.strip(): (v or "").strip() for k, v in row.items()})


def parse_lr(s):
    s = s.strip()
    if "-" in s:
        a, b = s.split("-", 1)
        return a.strip(), b.strip()
    return s, ""


def q(row, col):
    try:
        return int(row.get(col) or 0)
    except ValueError:
        return 0


# Fernando-only deposit targets
MAP = {
    "S00_D1": {
        "cliente_id": 2100,
        "segmento": "Adultos",
        "categoria": "tienda",
        "tabla": "deposito_1_2100_tienda",
    },
    "S00_D2": {
        "cliente_id": 2100,
        "segmento": "Adultos",
        "categoria": "guardado",
        "tabla": "deposito_2_2100_guardado",
    },
    "S00_NINHOS": {
        "cliente_id": 2900,
        "segmento": "Niños",
        "categoria": "tienda",
        "tabla": "deposito_1_2900_tienda",
    },
}

# Known GRUPO -> marca from prior BD join (Fernando sample)
GRUPO_MARCA = {
    "01": "VIZZANO + BEIRA RIO",
    "02": "VIZZANO",
    "03": "MODARE",
    "04": "MOLECA",
    "05": "MOLEKINHO + MOLEKINHA",
    "06": "MOLEKINHO",
    "07": "ACTVITTA",
    "08": "BR SPORT",
}

stats = {}
for col, meta in MAP.items():
    stats[col] = {
        **meta,
        "filas": 0,
        "unidades": 0,
        "grupos": Counter(),
        "lineas": Counter(),
        "moleculas": set(),
    }

for row in rows:
    l, r = parse_lr(row["COD.ART.PROVEEDOR"])
    mat = row["COD.MATERIAL"]
    cor = row["COD.COLOR"]
    grada = row["DESCRIPCION GRADA"]
    mol = (l, r, mat, cor, grada)
    for col in MAP:
        qty = q(row, col)
        if qty <= 0:
            continue
        s = stats[col]
        s["filas"] += 1
        s["unidades"] += qty
        s["grupos"][row["GRUPO"]] += qty
        s["lineas"][l] += qty
        s["moleculas"].add(mol)

print("FERNANDO sdfm3316.csv -> Report depositos")
print(f"Total filas CSV: {len(rows)}\n")

for col, s in stats.items():
    print(f"--- {col} ---")
    print(f"  cliente_id: {s['cliente_id']} | {s['segmento']} | {s['categoria']}")
    print(f"  tabla BD: {s['tabla']}")
    print(f"  filas con stock: {s['filas']} | unidades: {s['unidades']}")
    print(f"  moleculas unicas: {len(s['moleculas'])} | lineas: {len(s['lineas'])} | grupos: {len(s['grupos'])}")
    print("  GRUPO (unidades):", dict(s["grupos"].most_common()))
    print()

print("=== GRUPO cruzado (unidades) ===")
all_grupos = sorted(set(g for s in stats.values() for g in s["grupos"]))
for g in all_grupos:
    d1 = stats["S00_D1"]["grupos"].get(g, 0)
    d2 = stats["S00_D2"]["grupos"].get(g, 0)
    ni = stats["S00_NINHOS"]["grupos"].get(g, 0)
    marca = GRUPO_MARCA.get(g, "?")
    seg = "ADULTOS" if d1 or d2 else "NIÑOS" if ni else "?"
    print(f"  GRUPO {g} ({marca}) [{seg}]: D1={d1} D2={d2} NINHOS={ni}")

print("\n=== Capacidad relacional (campos CSV -> columnas BD deposito) ===")
fields = [
    ("COD.ART.PROVEEDOR", "linea_codigo_proveedor + referencia_codigo_proveedor"),
    ("COD.MATERIAL", "excel_material_code / material_id"),
    ("COD.COLOR", "excel_color_code / color_id"),
    ("DESCRIPCION GRADA", "grada"),
    ("CODIGO ARTICULO", "codigo_barras"),
    ("LPN", "precio_unitario (÷1000?)"),
    ("GRUPO", "sin columna directa -> derivar marca_id via linea"),
    ("S00_*", "cantidad + cliente_id + categoria destino"),
]
for csv_f, bd_f in fields:
    print(f"  {csv_f:22} -> {bd_f}")
