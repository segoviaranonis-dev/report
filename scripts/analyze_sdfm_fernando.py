"""Analiza CSV sdfm Bazzar (Fernando) -> mapeo depositos Report."""
import csv
import sys
from collections import Counter
from pathlib import Path

DEFAULT = Path(__file__).resolve().parents[1].parent / "sdfm4708.csv"

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


def parse_lr(s: str) -> tuple[str, str]:
    s = s.strip()
    if "-" in s:
        a, b = s.split("-", 1)
        return a.strip(), b.strip()
    return s, ""


def q(row: dict, col: str) -> int:
    try:
        return int(row.get(col) or 0)
    except ValueError:
        return 0


def detect_delimiter(path: Path) -> str:
    first = path.read_text(encoding="latin-1").splitlines()[0]
    return "|" if "|" in first else ";"


def load_rows(path: Path) -> list[dict]:
    delim = detect_delimiter(path)
    rows = []
    with path.open(encoding="latin-1") as f:
        for row in csv.DictReader(f, delimiter=delim):
            rows.append({k.strip(): (v or "").strip() for k, v in row.items()})
    return rows


def grupo_key(row: dict) -> str:
    return row.get("COD.GRUPO") or row.get("GRUPO") or ""


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    rows = load_rows(path)
    stats = {}
    for col, meta in MAP.items():
        stats[col] = {**meta, "filas": 0, "unidades": 0, "grupos": Counter(), "lineas": Counter(), "moleculas": set()}

    for row in rows:
        l, r = parse_lr(row["COD.ART.PROVEEDOR"])
        mol = (l, r, row["COD.MATERIAL"], row["COD.COLOR"], row["DESCRIPCION GRADA"])
        for col in MAP:
            qty = q(row, col)
            if qty <= 0:
                continue
            s = stats[col]
            s["filas"] += 1
            s["unidades"] += qty
            s["grupos"][grupo_key(row)] += qty
            s["lineas"][l] += qty
            s["moleculas"].add(mol)

    print(f"Fernando {path.name} -> Report depositos")
    print(f"Total filas CSV: {len(rows)}\n")
    for col, s in stats.items():
        print(f"--- {col} ---")
        print(f"  cliente_id: {s['cliente_id']} | {s['segmento']} | {s['categoria']}")
        print(f"  tabla BD: {s['tabla']}")
        print(f"  filas con stock: {s['filas']} | unidades: {s['unidades']}")
        print(f"  moleculas: {len(s['moleculas'])} | lineas: {len(s['lineas'])} | grupos: {len(s['grupos'])}")
        print("  GRUPO:", dict(s["grupos"].most_common(8)))
        print()


if __name__ == "__main__":
    main()
