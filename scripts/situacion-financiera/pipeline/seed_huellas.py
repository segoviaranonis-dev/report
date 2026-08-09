# -*- coding: utf-8 -*-
"""Seed T03/T04 local desde corte AL 03-08 (aprueba huellas conocidas).

Uso:
  python seed_huellas.py
  python seed_huellas.py --entrada ..\\intake\\corte-AL-03-08-26
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from clasificador import clasificar_carpeta  # noqa: E402
from parsers import parse_por_tipo  # noqa: E402
from persistencia import CatalogoLocal  # noqa: E402

DEFAULT_IN = Path(__file__).resolve().parents[1] / "intake" / "corte-AL-03-08-26"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", type=Path, default=DEFAULT_IN)
    args = ap.parse_args()
    entrada = args.entrada.resolve()
    cat = CatalogoLocal()
    clasifs = clasificar_carpeta(entrada)
    n = 0
    for c in clasifs:
        data = parse_por_tipo(c.tipo, Path(c.path))
        filas = data.get("filas") or []
        cols = [k for k in (filas[0].keys() if filas else []) if k != "Fuente"]
        # merge columnas si ya había seed parcial
        prev = cat.tipos.get(c.tipo, {}).get("columnas_esperadas") or []
        merged = sorted(set(prev) | set(cols))
        cat.ensure_tipo(c.tipo, merged)
        cat.tipos[c.tipo]["columnas_esperadas"] = merged
        cat.aprobar_huella(c.tipo, c.huella, c.programa_erp)
        n += 1
        print(f"  OK {c.nombre} -> {c.tipo} cols={len(merged)}")
    cat.save_catalogo()
    print(f"Seed listo: {n} archivos · tipos={len(cat.tipos)} · "
          f"huellas={sum(len(v) for v in cat.huellas.values())}")
    print(f"Catálogo: {cat.root}")


if __name__ == "__main__":
    main()
