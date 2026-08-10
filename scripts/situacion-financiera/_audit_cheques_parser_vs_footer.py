# -*- coding: utf-8 -*-
"""Audit: Σ parse_cheques_vencer == TOTAL GENERAL/CHEQUE del pie TXT."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PIPE = Path(__file__).resolve().parent / "pipeline"
sys.path.insert(0, str(PIPE))
from clasificador import leer_texto  # noqa: E402
from parsers import parse_cheques_vencer  # noqa: E402

INTAKE = Path(__file__).resolve().parent / "intake" / "corte-AL-03-08-26"
MOL = (
    Path(__file__).resolve().parents[2]
    / "src/lib/situacion-financiera/molecular-al-0308.json"
)


def footer_gs(texto: str) -> int | None:
    """Pie ERP: letras espaciadas 'T O T A L   C H E Q U E' / GENERAL + importe con comas."""
    best = None
    for ln in texto.splitlines():
        compact = re.sub(r"\s+", "", ln.upper())
        if not (
            "TOTALCHEQUE" in compact
            or "TOTALGENERAL" in compact
            or "INCLUIDOSCH" in compact
        ):
            continue
        for m in re.finditer(r"(\d{1,3}(?:,\d{3})+)", ln):
            raw = m.group(1).replace(",", "")
            try:
                v = int(raw)
            except ValueError:
                continue
            if v >= 1_000_000 and (best is None or v > best):
                best = v
    return best


def main() -> None:
    fails = []
    print("AUDIT_CHEQUES_PARSER_VS_FOOTER")
    for p in sorted(INTAKE.glob("*CHEQUES*")):
        raw = leer_texto(p)
        foot = footer_gs(raw)
        r = parse_cheques_vencer(p)
        s = r["totales"]["importe_gs"]
        # OBS: moneda + texto
        obs = 0
        for ln in raw.splitlines():
            if re.search(r"([\d,]{3,})\s+(Gs|Dls|R\$)\s+\S", ln) and re.search(
                r"\d{2}/\d{2}/\d{2}", ln
            ):
                if "TOTAL" not in ln.upper():
                    obs += 1
        if foot is None:
            fails.append(f"{p.name}: sin pie TOTAL")
        elif foot != s:
            fails.append(f"{p.name}: sum={s} foot={foot} delta={foot-s} obs={obs}")
        else:
            print(f"  OK {p.name} n={r['totales']['n']} gs={s} obs_lines={obs}")

    mol = json.loads(MOL.read_text(encoding="utf-8"))
    ago = mol.get("cheques:2026-08", {}).get("gs")
    if ago != 1943223316:
        fails.append(f"molecular cheques:2026-08 gs={ago} esperado 1943223316")
    else:
        print("  OK molecular cheques:2026-08 = 1943223316")

    if fails:
        print("FAIL")
        for f in fails:
            print(" ", f)
        raise SystemExit(1)
    print("PASS todos los CHEQUES intake · Σ = pie · OBS incluidas")


if __name__ == "__main__":
    main()
