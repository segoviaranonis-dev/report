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
    """Código módulo Carlos en cabecera (ej. ifcqvg$). Conserva $."""
    m = re.search(r"(?i)\b(if[a-z0-9_]+)(\$)?", texto[:800])
    if not m:
        return None
    base = m.group(1).lower()
    return base + ("$" if m.group(2) else "")


def clasificar_por_programa(programa: str | None) -> tuple[str, float, str] | None:
    """Padrón Hiedra: el programa manda sobre el nombre de archivo."""
    if not programa:
        return None
    p = programa.lower()
    # ifcqvg$ = cheques a vencer (consumo íntegro Faro)
    if p in ("ifcqvg$", "ifcqvg"):
        return "cheques_vencer", 0.99, "padrón programa ifcqvg$"
    if p in ("ifslclfd", "ifslclfd$"):
        return "saldos_detallado", 0.99, "padrón programa ifslclfd"
    if p in ("ifslclfc", "ifslclfc$"):
        return "saldos_resumen", 0.99, "padrón programa ifslclfc"
    if p in ("ifatsl3", "ifatsl3$"):
        return "ventas_bzz", 0.99, "padrón programa ifatsl3"
    if p in ("iflbvtm", "iflbvtm$"):
        return "ventas_mensuales", 0.99, "padrón programa iflbvtm"
    if p in ("ifft_ds", "ifft_ds$"):
        return "ventas_dto", 0.99, "padrón programa ifft_ds"
    return None


def clasificar_archivo(path: Path) -> Clasificacion:
    texto = leer_texto(path)
    head = cabecera(texto)
    prog = _programa_erp(head)
    nombre = path.name.upper()

    tip, conf, nota = "desconocido", 0.0, ""

    # 1) Padrón por programa_erp (Hiedra) — gana al nombre de archivo
    por_prog = clasificar_por_programa(prog)
    if por_prog:
        tip, conf, nota = por_prog

    # 2) Nombre de archivo solo como refuerzo si aún desconocido
    if tip == "desconocido":
        if "CHEQUES" in nombre and "VENCER" in nombre:
            tip, conf, nota = "cheques_vencer", 0.9, "por nombre de archivo"
        elif "SALDO" in nombre and "DETALL" in nombre:
            tip, conf, nota = "saldos_detallado", 0.92, "por nombre de archivo"
        elif "SALDO" in nombre and "CLIENT" in nombre:
            tip, conf, nota = "saldos_resumen", 0.9, "por nombre de archivo"
        elif nombre.startswith("PV") or "PROG" in nombre:
            tip, conf, nota = "pv_prog", 0.85, "por nombre de archivo"

    # 3) Reglas de contenido / título
    for tipo, c, pat, desc in REGLAS:
        if pat.search(head) or pat.search(texto[:2500]):
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
