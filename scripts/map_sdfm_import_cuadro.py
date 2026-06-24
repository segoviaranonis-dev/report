"""Mapa import sdfm3316.csv -> depositos BD Fernando (migracion 114)."""
import csv
from collections import Counter, defaultdict

CSV_PATH = r"C:\Users\hecto\Nexus_Core\sdfm3316.csv"

GRUPO_MARCA = {
    "01": ("VIZZANO + BEIRA RIO", "1,2", "ADULTOS"),
    "02": ("VIZZANO", "2", "ADULTOS"),
    "03": ("MODARE", "3", "ADULTOS"),
    "04": ("MOLECA", "4", "ADULTOS"),
    "05": ("MOLEKINHA + MOLEKINHO", "5,6", "NIÑOS"),
    "06": ("MOLEKINHO", "6", "NIÑOS"),
    "07": ("ACTVITTA", "7", "ADULTOS"),
    "08": ("BR SPORT", "8", "ADULTOS"),
}

DEST = {
    "S00_D1": {
        "col_csv": "S00_D1",
        "cliente_id": 2100,
        "segmento": "Adultos",
        "categoria": "tienda",
        "tabla": "deposito_1_2100_tienda",
        "toggle_ui": "TIENDA",
    },
    "S00_D2": {
        "col_csv": "S00_D2",
        "cliente_id": 2100,
        "segmento": "Adultos",
        "categoria": "guardado",
        "tabla": "deposito_2_2100_guardado",
        "toggle_ui": "GUARDADO",
    },
    "S00_NINHOS": {
        "col_csv": "S00_NINHOS",
        "cliente_id": 2900,
        "segmento": "Niños",
        "categoria": "tienda",
        "tabla": "deposito_1_2900_tienda",
        "toggle_ui": "TIENDA",
    },
}


def q(row, col):
    try:
        return int((row.get(col) or "0").strip() or 0)
    except ValueError:
        return 0


def parse_lr(s):
    s = (s or "").strip()
    if "-" in s:
        a, b = s.split("-", 1)
        return a.strip(), b.strip()
    return s, ""


rows = []
with open(CSV_PATH, encoding="latin-1") as f:
    for row in csv.DictReader(f, delimiter=";"):
        rows.append({k.strip(): (v or "").strip() for k, v in row.items()})

# Aggregate: dest_key -> grupo -> {filas, unidades, moleculas}
agg = {k: defaultdict(lambda: {"filas": 0, "unidades": 0}) for k in DEST}
totals = {k: {"filas": 0, "unidades": 0, "moleculas": 0} for k in DEST}

for row in rows:
    g = row.get("GRUPO", "?")
    for dk, meta in DEST.items():
        col = meta["col_csv"]
        qty = q(row, col)
        if qty <= 0:
            continue
        agg[dk][g]["filas"] += 1
        agg[dk][g]["unidades"] += qty
        totals[dk]["filas"] += 1
        totals[dk]["unidades"] += qty

print("=" * 90)
print("IMPORT MAP — sdfm3316.csv (Fernando) -> Supabase depositos")
print(f"Filas CSV total: {len(rows)}")
print("=" * 90)

print("\n## A. Destino por columna CSV\n")
print("| Col CSV | cliente_id | Segmento | Toggle | Tabla BD | Filas | Unidades |")
print("|---------|------------|----------|--------|----------|------:|---------:|")
for dk, meta in DEST.items():
    t = totals[dk]
    print(
        f"| `{meta['col_csv']}` | **{meta['cliente_id']}** | {meta['segmento']} | "
        f"{meta['toggle_ui']} | `{meta['tabla']}` | {t['filas']} | {t['unidades']} |"
    )

print("\n## B. Cantidad por MARCA (GRUPO) x DEPÓSITO\n")
print("| GRUPO | Marca(s) | id_marca | Seg. | D1 -> 2100 tienda | D2 -> 2100 guardado | NINHOS -> 2900 tienda | TOTAL |")
print("|-------|----------|----------|------|------------------:|--------------------:|----------------------:|------:|")
all_grupos = sorted(set(g for d in agg.values() for g in d))
for g in all_grupos:
    marca, ids, seg = GRUPO_MARCA.get(g, ("?", "?", "?"))
    d1 = agg["S00_D1"][g]["unidades"]
    d2 = agg["S00_D2"][g]["unidades"]
    ni = agg["S00_NINHOS"][g]["unidades"]
    if d1 + d2 + ni == 0:
        continue
    print(f"| {g} | {marca} | {ids} | {seg} | {d1} | {d2} | {ni} | **{d1+d2+ni}** |")

print("\n## C. Filas molécula por GRUPO x depósito\n")
print("| GRUPO | Marca | Filas D1 | Filas D2 | Filas NINHOS |")
print("|-------|-------|--------:|---------:|-------------:|")
for g in all_grupos:
    marca = GRUPO_MARCA.get(g, ("?", "?", "?"))[0]
    d1 = agg["S00_D1"][g]["filas"]
    d2 = agg["S00_D2"][g]["filas"]
    ni = agg["S00_NINHOS"][g]["filas"]
    if d1 + d2 + ni == 0:
        continue
    print(f"| {g} | {marca} | {d1} | {d2} | {ni} |")

print("\n## D. Acción import futura (1 fila CSV -> 1 INSERT por columna > 0)\n")
print("| Paso | Acción |")
print("|------|--------|")
print("| 1 | Leer fila CSV (`;`) |")
print("| 2 | Parsear L-R de `COD.ART.PROVEEDOR` |")
print("| 3 | Por cada col S00_D1 / S00_D2 / S00_NINHOS con qty>0 |")
print("| 4 | Resolver `marca_id` desde `linea` (validar matriz Chusar 2.3.6.4) |")
print("| 5 | `INSERT` en tabla destino con `cantidad`, `cliente_id`, FKs pilares |")
print("| 6 | Opcional: `DELETE` previo por tabla o upsert por molécula |")

print("\n## E. Ejemplo fila -> INSERT\n")
sample = next(r for r in rows if q(r, "S00_D1") > 0)
l, ref = parse_lr(sample["COD.ART.PROVEEDOR"])
print(f"CSV: GRUPO={sample['GRUPO']} L-R={l}-{ref} mat={sample['COD.MATERIAL']} cor={sample['COD.COLOR']} grada={sample['DESCRIPCION GRADA']} D1={sample['S00_D1']}")
print(f"  -> INSERT deposito_1_2100_tienda (cliente_id=2100, cantidad={sample['S00_D1']}, ...)")

print("\n## F. Totales resumen import\n")
grand = sum(totals[k]["unidades"] for k in DEST)
print(f"Unidades totales a importar: {grand}")
print(f"Registros INSERT (filas con stock): {sum(totals[k]['filas'] for k in DEST)}")
print(f"Tablas tocadas: 3 de 6 Fernando (tienda adultos, guardado adultos, tienda niños)")
