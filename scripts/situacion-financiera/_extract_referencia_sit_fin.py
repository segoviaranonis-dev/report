# -*- coding: utf-8 -*-
"""Extrae hoja Sit Fin de Excels ADMIN (referencia oro) — SOLO LECTURA para auditoría.

PROHIBIDO usar estos números para sobrescribir el molecular Nexus.
Canon Nexus = TXT ERP × clientes.xlsx × mapeo auditable.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
INTAKE = ROOT / "scripts/situacion-financiera/intake/referencia-admin"
OUT_DIR = ROOT / "src/lib/situacion-financiera"

ARCHIVOS = [
    {
        "path": INTAKE / "07.SITUACION_FINANCIERA_01072026.xlsx",
        "sheet": "SIT FIN",
        "corte": "2026-07-01",
        "mes_base": "2026-07",
        "rol": "base_admin",
        "out": OUT_DIR / "referencia-admin-jul-0107.json",
    },
    {
        "path": INTAKE / "08.SITUACION_FINANCIERA_01082026.xlsx",
        "sheet": "Situacion",
        "corte": "2026-08-01",
        "mes_base": "2026-08",
        "rol": "referencia_admin_ago",
        "out": OUT_DIR / "referencia-admin-ago-0108.json",
    },
]

MES_ES = {
    "ENERO": "01",
    "FEBRERO": "02",
    "MARZO": "03",
    "ABRIL": "04",
    "MAYO": "05",
    "JUNIO": "06",
    "JULIO": "07",
    "AGOSTO": "08",
    "SEPTIEMBRE": "09",
    "SETIEMBRE": "09",
    "OCTUBRE": "10",
    "NOVIEMBRE": "11",
    "DICIEMBRE": "12",
}


def norm_label(s: str) -> str:
    u = " ".join((s or "").upper().split())
    u = u.replace("PAGOS DE BAZZAR", "PAGOS BAZZAR").replace("PAGOS BAZZAR", "PAGOS BAZZAR")
    return u.strip(" .")


def concepto_key(label: str) -> str:
    u = norm_label(label)
    if "TASA DE CAMBIO" in u:
        return "tasa"
    if "SALDO EN USD" in u and "CONTINENTAL" in u:
        return "banco:continental_usd"
    if "SALDO EN GS" in u and "CONTINENTAL" in u:
        return "banco:continental_gs"
    if "ITAU" in u:
        return "banco:itau_gs"
    if "USD" in u and "BANCOOP" in u:
        return "banco:bancoop_usd"
    if "BANCOOP" in u:
        return "banco:bancoop_gs"
    if "GNB" in u:
        return "banco:gnb_gs"
    if "BNF" in u:
        return "banco:bnf_gs"
    if "CHEQUES A VENCER" in u:
        return "cheques"
    if "SALDO DE CLIENTES VENCIDOS A 30" in u:
        return "aging:v30"
    if "SALDO DE CLIENTES VENCIDOS A 60" in u:
        return "aging:v60"
    if u.startswith("SALDO DE CLIENTES"):
        return "clientes"
    if "MERCADERIA" in u:
        return "mercaderia"
    if "BAZZAR" in u:
        return "bazzar"
    if "PV Y PROG" in u:
        return "pv"
    if "LUISITO" in u:
        return "luisito"
    if "PROVEEDOR" in u:
        return "proveedores"
    if "DESPACHO" in u:
        return "despacho"
    if "PREVISION GASTOS" in u:
        return "gastos_op"
    if "PRESTAMO" in u:
        return "prestamo"
    if "SALDO DISPONIBLE" in u:
        return "disponible"
    return f"otro:{u[:40]}"


def mes_desde_disponible(label: str) -> str | None:
    u = norm_label(label)
    m = re.search(
        r"SALDO DISPONIBLE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})",
        u,
    )
    if not m:
        return None
    return f"{m.group(2)}-{MES_ES[m.group(1)]}"


def extract(cfg: dict) -> dict:
    wb = openpyxl.load_workbook(cfg["path"], data_only=True, read_only=True)
    ws = wb[cfg["sheet"]]
    tasa = None
    rows = []
    mes_ctx = cfg["mes_base"]
    bloque = 0
    for i, row in enumerate(ws.iter_rows(min_row=1, max_col=6, values_only=True), start=1):
        cells = list(row)
        label = None
        gs = None
        usd = None
        for c in cells:
            if isinstance(c, datetime):
                mes_ctx = f"{c.year}-{c.month:02d}"
                bloque += 1
            elif isinstance(c, str) and c.strip() and label is None:
                label = c.strip()
        nums = [c for c in cells if isinstance(c, (int, float)) and not isinstance(c, bool)]
        if label and "TASA DE CAMBIO" in label.upper() and nums:
            tasa = float(nums[0])
            continue
        if not label:
            continue
        lab_u = label.upper()
        if "PREVISION A LA FECHA" in lab_u or lab_u.strip() == "SALDOS":
            continue
        if "IMPORTE EN" in lab_u:
            continue
        if nums:
            gs = float(nums[0])
            if len(nums) > 1:
                usd = float(nums[1])
        key = concepto_key(label)
        row_mes = mes_ctx
        if key == "disponible":
            ym = mes_desde_disponible(label)
            if ym:
                row_mes = ym
                mes_ctx = ym
        rows.append(
            {
                "r": i,
                "label": label,
                "concepto": key,
                "mes_ctx": row_mes,
                "bloque": bloque,
                "gs": gs,
                "usd": usd,
            }
        )
    wb.close()

    # Primer bloque = mes del corte (base)
    primer_mes = cfg["mes_base"]
    base = [r for r in rows if r["mes_ctx"] == primer_mes and r["concepto"] != "tasa"]
    # Si mes_ctx no quedó bien, tomar hasta primer disponible
    if not base:
        base = []
        for r in rows:
            base.append(r)
            if r["concepto"] == "disponible":
                break

    por_concepto = {}
    for r in base:
        if r["gs"] is None:
            continue
        por_concepto[r["concepto"]] = {
            "label": r["label"],
            "gs": r["gs"],
            "usd": r["usd"],
            "r": r["r"],
        }

    return {
        "rol": cfg["rol"],
        "corte": cfg["corte"],
        "mes_base": cfg["mes_base"],
        "archivo": cfg["path"].name,
        "hoja": cfg["sheet"],
        "tasaUsd": tasa,
        "ley": "REFERENCIA ADMIN · no copiar a molecular Nexus · no parchear deltas",
        "n_filas": len(rows),
        "base_mes": por_concepto,
        "todas": rows,
    }


def main():
    outs = []
    for cfg in ARCHIVOS:
        if not cfg["path"].exists():
            raise SystemExit(f"Falta {cfg['path']}")
        data = extract(cfg)
        cfg["out"].write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        outs.append((cfg["out"].name, data["mes_base"], list(data["base_mes"].keys())))
        print("ok", cfg["out"], "conceptos_base", len(data["base_mes"]), "tasa", data["tasaUsd"])
    return outs


if __name__ == "__main__":
    main()
