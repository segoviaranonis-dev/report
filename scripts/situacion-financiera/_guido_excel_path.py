# -*- coding: utf-8 -*-
"""Ruta canon Excel Guido 08 — tercera respuesta (2026-08-12)."""
from __future__ import annotations

from pathlib import Path

SF_SCRIPTS = Path(__file__).resolve().parent
INTAKE_GUIDO = (
    SF_SCRIPTS
    / "intake/guido-20260812/08.SITUACION FINANCIERA 01082026.xlsx"
)
DOWNLOADS_GUIDO = Path(
    r"C:\Users\hecto\Downloads\08.SITUACION FINANCIERA 01082026.xlsx"
)
Z_GUIDO = Path(r"Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx")

CANDIDATOS = (INTAKE_GUIDO, DOWNLOADS_GUIDO, Z_GUIDO)


def resolver_excel_guido_08() -> Path:
    for p in CANDIDATOS:
        if p.exists():
            return p
    raise FileNotFoundError(
        "Excel Guido 08 no encontrado. Candidatos: "
        + ", ".join(str(p) for p in CANDIDATOS)
    )
