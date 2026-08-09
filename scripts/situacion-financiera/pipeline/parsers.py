# -*- coding: utf-8 -*-
"""Parsers por tipo canónico → filas dict + totales.

Diseño: cada parser tolera corrimientos leves (token / regex) y reporta filas_ok / skip.
"""
from __future__ import annotations

import csv
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from clasificador import leer_texto

_NUM = re.compile(r"-?\d{1,3}(?:,\d{3})+|-?\d+")


def _entero(tok: str) -> int:
    neg = tok.startswith("-") or tok.endswith("-")
    return (-1 if neg else 1) * int(tok.replace(",", "").replace("-", ""))


def _es_guiones(l: str) -> bool:
    s = l.strip()
    return len(s) > 10 and all(c in "_- " for c in s) and any(c in "_-" for c in s)


def parse_cheques_vencer(path: Path) -> dict[str, Any]:
    """Lista ERP ifcqvg$ · cada fila = 1 cheque respaldado por línea limpia del TXT."""
    texto = leer_texto(path)
    filas = []
    for nro_linea, l in enumerate(texto.splitlines(), start=1):
        if _es_guiones(l) or "[" in l:
            continue
        up = l.upper()
        if "SUB" in up and "TOTAL" in up:
            continue
        if "TOTAL" in up and "GENERAL" in up:
            continue
        if not re.search(r"\d{2}/\d{2}/\d{2}", l):
            continue
        m = re.search(r"([\d,]{3,})\s+(Gs|Dls|R\$)\s*$", l.rstrip())
        if not m:
            continue
        importe = _entero(m.group(1))
        moneda = m.group(2)
        fechas = re.findall(r"\d{2}/\d{2}/\d{2}", l)
        fvto = fechas[0] if fechas else ""
        fproc = fechas[1] if len(fechas) > 1 else ""
        mban = re.match(r"\s*([A-Z]{2,5})\s+(.+?)\s{2,}(\d{5,10})\s+(.+?)\s+(\d{3,5})\s+\d{2}/\d{2}/\d{2}", l)
        if mban:
            banco, banco_nom, nro, emitente, cod = (
                mban.group(1),
                mban.group(2).strip(),
                mban.group(3),
                mban.group(4).strip(),
                mban.group(5),
            )
        else:
            mban2 = re.match(r"\s*([A-Z]{2,5})\s+", l)
            banco = mban2.group(1) if mban2 else ""
            banco_nom = ""
            mcli = re.search(r"(\d{3,5})\s+\d{2}/\d{2}/\d{2}", l)
            cod = mcli.group(1) if mcli else ""
            mcheque = re.search(r"\b(\d{5,10})\b", l)
            nro = mcheque.group(1) if mcheque else ""
            emitente = ""
        linea_limpia = " ".join(l.split())
        filas.append(
            {
                "Banco_Cod": banco,
                "Banco_Nombre": banco_nom,
                "Nro_Cheque": nro,
                "Emitente": emitente,
                "Cod_Cliente": cod,
                "Fecha_Vto": fvto,
                "Fecha_Proc": fproc,
                "Importe": importe,
                "Moneda": moneda,
                "Fuente": path.name,
                "Nro_Linea": nro_linea,
                "Linea_Limpia": linea_limpia,
            }
        )
    total_gs = sum(f["Importe"] for f in filas if f["Moneda"] == "Gs")
    return {
        "tipo": "cheques_vencer",
        "filas": filas,
        "totales": {"n": len(filas), "importe_gs": total_gs},
    }


def parse_saldos_resumen(path: Path) -> dict[str, Any]:
    texto = leer_texto(path)
    filas = []
    for l in texto.splitlines():
        if _es_guiones(l) or "NOMBRE DEL CLIENTE" in l.upper() or "CODIGO" in l[:20]:
            continue
        if " Gs " not in f" {l} " and not re.search(r"\bGs\b", l):
            continue
        # nombre ... codigo moneda importes... saldo
        m = re.match(
            r"^(.+?)\s+(\d{2,6})\s+(Gs|Dls|R\$)\s+(.+)$",
            l.strip(),
        )
        if not m:
            continue
        nombre, cod, mon, rest = m.groups()
        nums = _NUM.findall(rest)
        if len(nums) < 1:
            continue
        try:
            saldo = _entero(nums[-1])
        except ValueError:
            continue
        filas.append(
            {
                "Nombre": nombre.strip(),
                "Cod_Cliente": cod,
                "Moneda": mon,
                "Saldo": saldo,
                "Fuente": path.name,
            }
        )
    return {
        "tipo": "saldos_resumen",
        "filas": filas,
        "totales": {
            "n": len(filas),
            "saldo_gs": sum(f["Saldo"] for f in filas),
            "saldo_positivo": sum(f["Saldo"] for f in filas if f["Saldo"] > 0),
        },
    }


def parse_saldos_detallado(path: Path) -> dict[str, Any]:
    texto = leer_texto(path)
    filas = []
    cliente = ""
    cod = ""
    fac_re = re.compile(r"^(\d{2,4}-\d{2,4}-\d{4,}|\d{5,})\s+")
    for l in texto.splitlines():
        mcli = re.match(r"^(.+?)\s*\((\d+)\)\s*\((Gs|Dls|R\$)\)\s*$", l.strip())
        if mcli:
            cliente, cod = mcli.group(1).strip(), mcli.group(2)
            continue
        if not fac_re.match(l):
            continue
        toks = _NUM.findall(l)
        if len(toks) < 3:
            continue
        try:
            dias = int(toks[-1].replace(",", ""))
            saldo = _entero(toks[-2])
        except ValueError:
            continue
        nro = l[:20].strip()
        filas.append(
            {
                "Nro_Factura": nro,
                "Cod_Cliente": cod,
                "Nombre": cliente,
                "Saldo": saldo,
                "Dias_Vencido": dias,
                "Fuente": path.name,
            }
        )

    aging = defaultdict(int)
    for f in filas:
        d = f["Dias_Vencido"]
        s = f["Saldo"]
        if d < 0:
            aging["no_vencido"] += s
        elif d <= 30:
            aging["v30"] += s
        elif d <= 60:
            aging["v60"] += s
        elif d <= 90:
            aging["v90"] += s
        elif d <= 120:
            aging["v120"] += s
        elif d <= 150:
            aging["v150"] += s
        elif d <= 180:
            aging["v180"] += s
        else:
            aging["v180p"] += s

    return {
        "tipo": "saldos_detallado",
        "filas": filas,
        "totales": {
            "n": len(filas),
            "saldo_gs": sum(f["Saldo"] for f in filas),
            "aging": dict(aging),
        },
    }


def parse_pv_prog(path: Path) -> dict[str, Any]:
    texto = leer_texto(path)
    # TSV con posibles múltiples vencimientos en cola
    lines = [ln for ln in texto.splitlines() if ln.strip()]
    if not lines:
        return {"tipo": "pv_prog", "filas": [], "totales": {"n": 0}}
    header = lines[0].split("\t")
    filas = []
    por_mes: dict[str, int] = defaultdict(int)
    for ln in lines[1:]:
        parts = ln.split("\t")
        if len(parts) < 10:
            continue
        try:
            importe_pedido = int(float(parts[7]))
            importe_cuota = int(float(parts[9]))
            ncuotas = int(float(parts[8] or 1))
        except ValueError:
            continue
        vtos = []
        for p in parts[10:]:
            p = p.strip()
            if re.fullmatch(r"\d{8}", p):
                vtos.append(p)
        row = {
            "Nro_Ped_Prov": parts[0],
            "Proforma": parts[1],
            "Cod_Cliente": parts[2],
            "Nro_Ped_Cliente": parts[3],
            "Cod_Operacion": parts[4],
            "Fecha_Pedido": parts[5],
            "Fecha_Entrega": parts[6],
            "Importe_Pedido": importe_pedido,
            "Cant_Cuotas": ncuotas,
            "Importe_Cuota": importe_cuota,
            "Vencimientos": "|".join(vtos),
            "Fuente": path.name,
        }
        filas.append(row)
        for v in vtos:
            ym = f"{v[:4]}-{v[4:6]}"
            por_mes[ym] += importe_cuota
    return {
        "tipo": "pv_prog",
        "filas": filas,
        "totales": {"n": len(filas), "por_mes_cuota": dict(sorted(por_mes.items()))},
    }


def parse_generico_lineas(path: Path) -> dict[str, Any]:
    """Fallback: no inventa columnas; deja huella + conteo para variación nueva."""
    texto = leer_texto(path)
    lines = [l for l in texto.splitlines() if l.strip() and not _es_guiones(l)]
    return {
        "tipo": "desconocido",
        "filas": [],
        "totales": {"n_lineas_utiles": len(lines)},
        "preview": lines[:8],
    }


PARSERS = {
    "cheques_vencer": parse_cheques_vencer,
    "saldos_resumen": parse_saldos_resumen,
    "saldos_detallado": parse_saldos_detallado,
    "saldos": parse_saldos_resumen,
    "pv_prog": parse_pv_prog,
}


def parse_por_tipo(tipo: str, path: Path) -> dict[str, Any]:
    fn = PARSERS.get(tipo, parse_generico_lineas)
    data = fn(path)
    data.setdefault("tipo", tipo)
    data["archivo"] = path.name
    return data


def escribir_csv(filas: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not filas:
        path.write_text("", encoding="utf-8")
        return
    keys = list(filas[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(filas)


def mes_desde_nombre_cheques(nombre: str) -> str | None:
    """'1.CHEQUES A VENCER_AGO26.txt' → '2026-08'."""
    u = nombre.upper()
    mapa = {
        "ENE": "01",
        "FEB": "02",
        "MAR": "03",
        "ABR": "04",
        "MAY": "05",
        "JUN": "06",
        "JUL": "07",
        "AGO": "08",
        "SEP": "09",
        "SET": "09",
        "OCT": "10",
        "NOV": "11",
        "DIC": "12",
    }
    # rango largo ene26 al 2029
    if "2029" in u or "AL 2029" in u:
        return "2027+"
    for k, mm in mapa.items():
        if k in u:
            # año 26/27 en nombre
            ym = re.search(r"(20)?(\d{2})", u)
            yy = "20" + ym.group(2) if ym else "2026"
            if len(yy) == 2:
                yy = "20" + yy
            # AGO26 → 2026
            m2 = re.search(rf"{k}(\d{{2}})", u)
            if m2:
                yy = "20" + m2.group(1)
            return f"{yy}-{mm}"
    return None
