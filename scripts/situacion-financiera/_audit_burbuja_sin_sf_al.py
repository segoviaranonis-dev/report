# -*- coding: utf-8 -*-
"""Auditoría: burbuja no debe citar SF AL como TXT."""
from __future__ import annotations

import json
import re
from pathlib import Path

SF = Path(__file__).resolve().parents[2] / "src/lib/situacion-financiera"


def main() -> None:
    fails = []
    for name in ("mapa-canon-al-0308.json", "audit-mapa-al-0308.json"):
        data = json.loads((SF / name).read_text(encoding="utf-8"))

        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in ("archivoTxt", "archivo_txt") and isinstance(v, str):
                        u = v.upper()
                        if "SF AL" in u:
                            fails.append(f"{name}:{k}={v[:60]}")
                        if ".XLSX" in u and ".TXT" not in u:
                            fails.append(f"{name}:xlsx_only:{v[:60]}")
                    else:
                        walk(v)
            elif isinstance(o, list):
                for x in o:
                    walk(x)

        walk(data)

    src = (SF / "alerta-inconsistencia.ts").read_text(encoding="utf-8")
    for needle in (
        "esFuenteTxtComparacion",
        'if (u.includes("SF AL")) return false',
        "if (!esFuenteTxtComparacion(archivoTxt)) return null",
        'if (key.startsWith("clientes:"))',
    ):
        if needle not in src:
            fails.append(f"alerta missing:{needle}")

    print("AUDIT_BURBUJA_SF_AL")
    if fails:
        print("FAIL", len(fails))
        for f in fails:
            print(" ", f)
        raise SystemExit(1)
    print("PASS mapa archivoTxt sin SF AL")
    print("PASS guarda codigo esFuenteTxtComparacion")
    print("PASS clientes:YYYY-MM sin burbuja por TXT falso")


if __name__ == "__main__":
    main()
