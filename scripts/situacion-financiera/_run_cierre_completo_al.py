# -*- coding: utf-8 -*-
"""Orquesta: molecular → auditoría Sit Fin → inventario intake."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(script: str) -> None:
    print(">>>", script)
    r = subprocess.run([sys.executable, str(HERE / script)], check=False)
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main():
    run("_gen_molecular_al.py")
    run("_gen_ola2_cuadro_guido.py")
    run("_gen_ola3_pv_prog_guido.py")
    run("_audit_mapa_excel_txt.py")
    run("_cerrar_inventario_al.py")
    run("_export_corte_cerrado_lab.py")
    run("_gen_comparacion_ago_jul.py")
    print("CIERRE COMPLETO AL OK")


if __name__ == "__main__":
    main()
