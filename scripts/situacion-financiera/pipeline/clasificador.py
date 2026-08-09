# -*- coding: utf-8 -*-
"""Clasificador de TXT ERP → tipo canónico (huellas + nombre).

Fundamento: nuevas variaciones del ERP se detectan por encabezado (`if*` / título).
Si no hay match → tipo `desconocido` + evidencia de huella (no silencioso).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


def leer_texto(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("cp1252", "latin-1", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def cabecera(texto: str, n: int = 20) -> str:
    """Líneas útiles del encabezado (salta guiones) para huella y reglas."""
    lines: list[str] = []
    for ln in texto.splitlines()[:80]:
        s = ln.strip()
        if not s:
            continue
        if len(s) > 10 and all(c in "_- " for c in s):
            continue
        lines.append(s)
        if len(lines) >= n:
            break
    return "\n".join(lines)


@dataclass
class Clasificacion:
    path: str
    nombre: str
    tipo: str
    confianza: float
    huella: str
    programa_erp: str | None
    notas: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# Orden importa: más específico primero.
REGLAS: list[tuple[str, float, re.Pattern[str], str]] = [
    (
        "cheques_vencer",
        0.95,
        re.compile(r"LISTADO DE CHEQUES A VENCER|ifcqvg\$", re.I),
        "Cheques a vencer (ancho fijo)",
    ),
    (
        "cheques_depositados",
        0.95,
        re.compile(r"CHEQUES DEPOSITADOS", re.I),
        "Cheques depositados",
    ),
    (
        "saldos_detallado",
        0.97,
        re.compile(r"ifslclfd|NRO\s+FACTURA.*D\.?VDOS|LISTADO DE SALDOS.*SOLAME", re.I),
        "Saldos clientes detallado (factura)",
    ),
    (
        "saldos_resumen",
        0.95,
        re.compile(r"ifslclfc|NOMBRE DEL CLIENTE\s+CODIGO\s+MONED", re.I),
        "Saldos clientes resumen",
    ),
    (
        "saldos",
        0.85,
        re.compile(r"LISTADO DE SALDOS AL", re.I),
        "Saldos (genérico)",
    ),
    (
        "pagos",
        0.95,
        re.compile(r"CIERRE DE PAGOS", re.I),
        "Cierre de pagos",
    ),
    (
        "ventas_dto",
        0.95,
        re.compile(r"FACTURAS CON DESCUENTOS|ifft_ds", re.I),
        "Ventas con descuento",
    ),
    (
        "ventas_mensuales",
        0.95,
        re.compile(r"LIBRO\s+DE\s+VENTAS\s+MENSUAL|iflbvtm", re.I),
        "Libro ventas mensuales",
    ),
    (
        "ventas_dia",
        0.9,
        re.compile(r"COND\.\s+VENTA\s+CODIGO\s+N O M B R E|NRO\.\s+\d{4}/\d{4}", re.I),
        "Ventas por día / control",
    ),
    (
        "ventas_bzz",
        0.95,
        re.compile(
            r"INFORME\s+GENERICO\s+VENTAS|ifatsl3|CLASIFIC:\s*(CLIENTE|FACTURA)",
            re.I,
        ),
        "Informe genérico ventas Bazzar",
    ),
    (
        "ventas",
        0.8,
        re.compile(r"\bVENTAS\b", re.I),
        "Ventas genérico",
    ),
    (
        "pv_prog",
        0.98,
        re.compile(r"Nro Ped\.?\s*Prov|Nro\.Proforma|Importe Cuota", re.I),
        "PV y programaciones (TSV/tabular)",
    ),
]


def _programa_erp(texto: str) -> str | None:
    m = re.search(r"\b(if[a-z0-9_\$]+)\b", texto[:800], re.I)
    return m.group(1) if m else None


def clasificar_archivo(path: Path) -> Clasificacion:
    texto = leer_texto(path)
    head = cabecera(texto)
    prog = _programa_erp(head)
    nombre = path.name.upper()

    # Nombre de archivo como refuerzo (variaciones de naming del funcionario).
    if "CHEQUES" in nombre and "VENCER" in nombre:
        tip, conf, nota = "cheques_vencer", 0.9, "por nombre de archivo"
    elif "SALDO" in nombre and "DETALL" in nombre:
        tip, conf, nota = "saldos_detallado", 0.92, "por nombre de archivo"
    elif "SALDO" in nombre and "CLIENT" in nombre:
        tip, conf, nota = "saldos_resumen", 0.9, "por nombre de archivo"
    elif nombre.startswith("PV") or "PROG" in nombre:
        tip, conf, nota = "pv_prog", 0.85, "por nombre de archivo"
    else:
        tip, conf, nota = "desconocido", 0.0, ""

    for tipo, c, pat, desc in REGLAS:
        if pat.search(head) or pat.search(texto[:2500]):
            # encabezado gana si es más específico / mayor confianza
            if c >= conf:
                tip, conf, nota = tipo, c, desc
            break

    # Huella: encabezado útil (sin guiones) — incluye LISTADO / if* para detectar variaciones
    huella = re.sub(r"\s+", " ", head[:400]).strip()
    return Clasificacion(
        path=str(path),
        nombre=path.name,
        tipo=tip,
        confianza=conf,
        huella=huella,
        programa_erp=prog,
        notas=nota,
    )


def clasificar_carpeta(carpeta: Path, glob: str = "*.txt") -> list[Clasificacion]:
    out: list[Clasificacion] = []
    for p in sorted(carpeta.glob(glob)):
        if p.is_file():
            out.append(clasificar_archivo(p))
    return out


def tipos_conocidos() -> list[str]:
    return sorted({t for t, *_ in REGLAS} | {"desconocido"})
