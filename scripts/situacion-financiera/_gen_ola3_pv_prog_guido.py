# -*- coding: utf-8 -*-
"""Ola 3 Guido — PV Y PROG A COBRAR (tercer reclamo · SF-REC-006).

Lee celdas **PV Y PROG A COBRAR** de hoja **Situacion** del Excel canon Guido
(tercera respuesta · Downloads/intake 2026-08-12).

Comentario General sigue «LO VEREMOS LUEGO» en columna explicación — Guido entrega
el **valor celda** en Situacion; Nexus alinea molecular/comparación a eso.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SF = ROOT / "src/lib/situacion-financiera"
MOL = SF / "molecular-al-0308.json"
OUT = SF / "ola3-pv-prog-0308.json"
REF = SF / "referencia-admin-ago-0108.json"

TASA = 5970.96

MES_LABEL = {
    "AGOSTO": "2026-08",
    "SETIEMBRE": "2026-09",
    "OCTUBRE": "2026-10",
    "NOVIEMBRE": "2026-11",
    "DICIEMBRE": "2026-12",
}


def _usd(gs: float) -> float:
    return round(gs / TASA, 2)


def _num(v) -> float:
    if v is None or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _ym_desde_contexto(fecha_cel, mes_ctx: str | None) -> str | None:
    if mes_ctx:
        return mes_ctx
    if fecha_cel is None:
        return "2026-08"
    s = str(fecha_cel)
    m = re.search(r"2026-(\d{2})", s)
    return f"2026-{m.group(1)}" if m else None


def extraer_pv_situacion_excel(path: Path) -> dict[str, dict]:
    import openpyxl

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb["Situacion"]
    out: dict[str, dict] = {}
    mes_ctx: str | None = "2026-08"

    for row in ws.iter_rows(values_only=True):
        if not row or len(row) < 4:
            continue
        fecha_cel = row[1]
        if fecha_cel is not None and "2026-" in str(fecha_cel):
            mes_ctx = _ym_desde_contexto(fecha_cel, None)

        lab = row[2]
        if lab is None:
            continue
        u = str(lab).upper().strip()
        if "PV Y PROG" not in u:
            continue

        gs = _num(row[3])
        ym = mes_ctx or "2026-08"
        # bloque base sin fecha en col B = agosto
        if fecha_cel is None and not out:
            ym = "2026-08"

        key = f"pv:{ym}"
        out[key] = {
            "gs": gs,
            "regla": "G4 · PV/PROG · celda Situacion · tercera respuesta Guido",
            "fuente_hoja": "Situacion",
            "mes_ctx": ym,
        }

    wb.close()
    return out


def extraer_pv_canon_ref(ref: dict) -> dict[str, dict]:
    """Fallback si Excel no abre."""
    out: dict[str, dict] = {}
    base = ref.get("base_mes") or {}
    if base.get("pv", {}).get("gs") is not None:
        ym = ref.get("mes_base") or "2026-08"
        out[f"pv:{ym}"] = {
            "gs": float(base["pv"]["gs"]),
            "regla": "G4 · PV/PROG · referencia-admin fallback",
            "fuente_hoja": "Situacion",
            "mes_ctx": ym,
        }
    for row in ref.get("todas") or []:
        if row.get("concepto") != "pv":
            continue
        ym = row.get("mes_ctx")
        if not ym:
            continue
        out[f"pv:{ym}"] = {
            "gs": float(row["gs"]),
            "regla": "G4 · PV/PROG · referencia-admin fallback",
            "fuente_hoja": "Situacion",
            "mes_ctx": ym,
        }
    return out


def parchear_molecular(metricas: dict[str, dict]) -> dict[str, float]:
    mol = json.loads(MOL.read_text(encoding="utf-8"))
    aplicados: dict[str, float] = {}
    fuente = "Ola3 PV Y PROG Guido · 08.SITUACION FINANCIERA 01082026.xlsx"

    for mol_key, info in sorted(metricas.items()):
        gs = float(info["gs"])
        aplicados[mol_key] = gs
        prev = mol.get(mol_key, {})
        prev_gs = prev.get("gs")
        mol[mol_key] = {
            **prev,
            "id": prev.get("id") or mol_key.replace(":", "-"),
            "label": prev.get("label") or mol_key.replace("pv:", "PV y PROG "),
            "gs": gs,
            "usd": _usd(gs),
            "meta": (
                f"Ola 3 · {info['regla']} · {info['mes_ctx']} "
                f"(antes Ola1/TSV={prev_gs}) · acordeón TXT conservado"
            ),
            "fuente": fuente,
            "ola3": True,
        }

    MOL.write_text(json.dumps(mol, ensure_ascii=False, indent=2), encoding="utf-8")
    return aplicados


def main() -> None:
    if not MOL.exists():
        print("FAIL: molecular ausente", file=sys.stderr)
        raise SystemExit(1)

    excel_path = None
    try:
        from _guido_excel_path import resolver_excel_guido_08

        excel_path = resolver_excel_guido_08()
        metricas = extraer_pv_situacion_excel(excel_path)
        fuente_excel = str(excel_path)
    except Exception as e:
        print("WARN Excel directo:", e, "→ fallback referencia-admin", file=sys.stderr)
        if not REF.exists():
            print("FAIL: sin Excel ni referencia admin", file=sys.stderr)
            raise SystemExit(1)
        ref = json.loads(REF.read_text(encoding="utf-8"))
        metricas = extraer_pv_canon_ref(ref)
        fuente_excel = ref.get("path") or ref.get("archivo")

    if not metricas:
        print("FAIL: sin filas PV", file=sys.stderr)
        raise SystemExit(1)

    aplicados = parchear_molecular(metricas)

    payload = {
        "corte": "AL-03-08-26",
        "ola": 3,
        "actualizado": "2026-08-16",
        "reclamo": "SF-REC-006",
        "excel_canon": fuente_excel,
        "hoja": "Situacion",
        "comentario_guido_pv": "LO VEREMOS LUEGO (metodología) · valor celda sí entregado",
        "pipeline": "Excel tercera respuesta Guido → celda PV Y PROG → molecular",
        "metricas": metricas,
        "aplicados_molecular": aplicados,
        "nota": "Detalle+Cuadro en mismo archivo · motor explotar_cuotas PV pendiente",
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("OLA3 PV OK", OUT)
    for k, gs in aplicados.items():
        print(f"  {k}: {gs:,.0f} Gs")


if __name__ == "__main__":
    main()
