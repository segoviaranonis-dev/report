# -*- coding: utf-8 -*-
"""Extrae metadatos de cabecera TXT ERP (Hiedra / Carlos).

Fecha emisión, hora, página, programa if*, filtros F.VTO / F.PROC / etc.
"""
from __future__ import annotations

import re
from typing import Any


def parse_cabecera_meta(texto: str) -> dict[str, Any]:
    head = "\n".join(texto.splitlines()[:25])
    meta: dict[str, Any] = {
        "fecha_emision": None,
        "hora_emision": None,
        "pagina": None,
        "programa_erp": None,
        "titulo_informe": None,
        "filtros": {},
        "cabecera_cruda": re.sub(r"\s+", " ", head[:500]).strip(),
    }

    m = re.search(r"Fecha:\s*(\d{2}/\d{2}/\d{4})", head, re.I)
    if m:
        meta["fecha_emision"] = m.group(1)

    m = re.search(r"Hora:\s*(\d{1,2}:\d{2})", head, re.I)
    if m:
        meta["hora_emision"] = m.group(1)

    m = re.search(r"Pag:\s*(\d+)", head, re.I)
    if m:
        meta["pagina"] = int(m.group(1))

    m = re.search(r"(?i)\b(if[a-z0-9_]+)(\$)?", head)
    if m:
        meta["programa_erp"] = m.group(1).lower() + ("$" if m.group(2) else "")
        if meta["programa_erp"] == "ifcqvg":
            meta["programa_erp"] = "ifcqvg$"

    for ln in head.splitlines():
        u = ln.upper()
        if any(
            x in u
            for x in (
                "LISTADO",
                "INFORME",
                "LIBRO",
                "CIERRE",
            )
        ):
            # quitar Fecha: al final si viene en la misma línea
            t = re.sub(r"\s+Fecha:\s*\d{2}/\d{2}/\d{4}.*$", "", ln, flags=re.I)
            t = re.sub(r"^RIMEC\s+S\.?A\.?\s*", "", t, flags=re.I).strip()
            if len(t) > 8:
                meta["titulo_informe"] = re.sub(r"\s+", " ", t)
                break

    # Filtros tipo CLAVE: valor  o  CLAVE: [a, b]
    for m in re.finditer(
        r"([A-Z][A-Z0-9_.]{1,12}):\s*(\[[^\]]+\]|[^\s\[][^\s]*)",
        head,
    ):
        k = m.group(1).upper()
        if k in ("FECHA", "HORA", "PAG"):
            continue
        meta["filtros"][k] = m.group(2).strip()

    # Marca (CHEQUES) etc.
    m = re.search(r"\(([A-ZÁÉÍÓÚÑ /]+)\)", head)
    if m:
        meta["filtros"]["MARCA"] = m.group(1).strip()

    return meta
