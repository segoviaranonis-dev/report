# -*- coding: utf-8 -*-
"""Comparación USD Julio ↔ Agosto — SOLO canones admin Guido.

CANON (rutas Guido):
  Z:\\hector\\SF\\07.SITUACION FINANCIERA 01072026.xlsx
  Z:\\hector\\SF\\08.SITUACION FINANCIERA 01082026.xlsx

Sit Fin isla / SF AL 03-08 / TXT del legajo pueden tener errores.
La métrica de columnas Jul/Ago/% se calcula SOLO entre esos dos Excels.
Sit Fin vs canon queda como auditoría (delta), no como columna primaria.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SF = ROOT / "src/lib/situacion-financiera"

JUL = SF / "referencia-admin-jul-0107.json"
AGO_ADMIN = SF / "referencia-admin-ago-0108.json"
MAPA = SF / "mapa-canon-al-0308.json"
MOL = SF / "molecular-al-0308.json"
OUT = SF / "comparacion-ago-vs-jul.json"

# Nombres tal cual Guido (carpeta Z:\\hector\\SF\\)
CANON_JUL_PATH = r"Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx"
CANON_AGO_PATH = r"Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx"
CANON_JUL_FILE = "07.SITUACION FINANCIERA 01072026.xlsx"
CANON_AGO_FILE = "08.SITUACION FINANCIERA 01082026.xlsx"

PUENTE = {
    "cheques": "cheques:2026-08",
    "clientes": "clientes:2026-08",
    "mercaderia": "mercaderia:2026-08",
    "aging:v30": "aging:v30",
    "aging:v60": "aging:v60",
    "bazzar": "bazzar:2026-08",
    "pv": "pv:2026-08",
    "luisito": "luisito:2026-08",
    "proveedores": "manual:proveedores:2026-08",
    "despacho": "manual:despacho:2026-08",
    "gastos_op": "manual:gastos:2026-08",
    "prestamo": "manual:prestamo:2026-08",
    "disponible": "disponible:2026-08",
    "banco:continental_usd": "banco:CONTINENTAL:USD",
    "banco:continental_gs": "banco:CONTINENTAL:GS",
    "banco:itau_gs": "banco:ITAU:GS",
    "banco:bancoop_usd": "banco:BANCOOP:USD",
    "banco:bancoop_gs": "banco:BANCOOP:GS",
    "banco:gnb_gs": "banco:GNB:GS",
    "banco:bnf_gs": "banco:BNF:GS",
}


def pct(actual: float | None, base: float | None) -> float | None:
    if actual is None or base is None:
        return None
    if base == 0:
        return None if actual == 0 else 100.0
    return round(100.0 * (actual - base) / abs(base), 2)


def main():
    jul = json.loads(JUL.read_text(encoding="utf-8"))
    ago_adm = json.loads(AGO_ADMIN.read_text(encoding="utf-8"))
    mapa = json.loads(MAPA.read_text(encoding="utf-8"))
    mol = json.loads(MOL.read_text(encoding="utf-8"))
    por_fila = mapa.get("porFila") or {}
    tasa_jul = float(jul.get("tasaUsd") or 6085.0)
    tasa_ago = float(ago_adm.get("tasaUsd") or 5970.96)

    # Sit Fin solo para auditoría vs canon (no es columna UI)
    sitfin_por_concepto: dict[str, dict] = {}
    molkey_to_canon = {}
    for _r, info in por_fila.items():
        mk = info.get("molKey")
        if not mk:
            continue
        molkey_to_canon[mk] = info.get("canonGs")

    for concepto, mk in PUENTE.items():
        gs = molkey_to_canon.get(mk)
        fuente = "mapa_canon_isla"
        if gs is None and mk in mol:
            gs = mol[mk].get("gs")
            fuente = "molecular_isla"
        if gs is None:
            for info in por_fila.values():
                if info.get("molKey") == mk:
                    gs = info.get("canonGs")
                    fuente = "mapa_canon_isla"
                    break
        if gs is None and mk.startswith("banco:") and mk in mol:
            gs = mol[mk].get("gs")
            fuente = "molecular_isla"
        sitfin_por_concepto[concepto] = {
            "gs": gs,
            "molKey": mk,
            "fuente": fuente,
        }

    for concepto, mk in PUENTE.items():
        if sitfin_por_concepto[concepto]["gs"] is None and mk in mol:
            sitfin_por_concepto[concepto] = {
                "gs": mol[mk].get("gs"),
                "molKey": mk,
                "fuente": "molecular_isla",
            }
        if mk in mol:
            sitfin_por_concepto[concepto]["molKey"] = mk

    filas = []
    base_jul = jul.get("base_mes") or {}
    ref_ago = ago_adm.get("base_mes") or {}

    for concepto, jul_info in sorted(base_jul.items()):
        jul_gs = jul_info.get("gs")
        jul_usd = jul_info.get("usd")
        if jul_usd is None and jul_gs is not None and tasa_jul:
            jul_usd = round(float(jul_gs) / tasa_jul, 2)

        adm = ref_ago.get(concepto) or {}
        adm_ago_gs = adm.get("gs")
        adm_ago_usd = adm.get("usd")
        if adm_ago_usd is None and adm_ago_gs is not None and tasa_ago:
            adm_ago_usd = round(float(adm_ago_gs) / tasa_ago, 2)

        # UI primaria: % entre canones admin USD
        p_usd_canon = pct(adm_ago_usd, jul_usd)
        p_gs_canon = pct(adm_ago_gs, jul_gs)

        sit = sitfin_por_concepto.get(concepto) or {}
        sit_gs = sit.get("gs")
        sit_usd = None
        if sit_gs is not None and tasa_ago:
            sit_usd = round(float(sit_gs) / tasa_ago, 2)

        filas.append(
            {
                "concepto": concepto,
                "label": jul_info.get("label") or adm.get("label"),
                # --- CANON UI ---
                "julio_base_gs": jul_gs,
                "julio_base_usd": jul_usd,
                "agosto_canon_gs": adm_ago_gs,
                "agosto_canon_usd": adm_ago_usd,
                # alias estables para UI (canon = admin Ago)
                "agosto_admin_gs": adm_ago_gs,
                "agosto_admin_usd": adm_ago_usd,
                "delta_usd_canon": (
                    None
                    if adm_ago_usd is None or jul_usd is None
                    else round(float(adm_ago_usd) - float(jul_usd), 2)
                ),
                "pct_usd_canon": p_usd_canon,
                "pct_admin_ago_vs_jul": p_gs_canon,
                "pct_usd_admin_ago_vs_jul": p_usd_canon,
                # --- auditoría Sit Fin vs canones (no columna primaria) ---
                "agosto_sitfin_gs": sit_gs,
                "agosto_sitfin_usd": sit_usd,
                "agosto_nexus_gs": sit_gs,
                "delta_usd_sitfin_vs_jul": (
                    None
                    if sit_usd is None or jul_usd is None
                    else round(sit_usd - jul_usd, 2)
                ),
                "pct_usd_sitfin_vs_jul": pct(sit_usd, jul_usd),
                "pct_sitfin_vs_jul": pct(sit_usd, jul_usd) or pct(sit_gs, jul_gs),
                "pct_nexus_vs_jul": pct(sit_usd, jul_usd) or pct(sit_gs, jul_gs),
                "delta_gs_sitfin_vs_jul": (
                    None
                    if sit_gs is None or jul_gs is None
                    else round(float(sit_gs) - float(jul_gs), 2)
                ),
                "delta_gs_nexus_vs_jul": (
                    None
                    if sit_gs is None or jul_gs is None
                    else round(float(sit_gs) - float(jul_gs), 2)
                ),
                "delta_sitfin_vs_admin_ago": (
                    None
                    if sit_gs is None or adm_ago_gs is None
                    else round(float(sit_gs) - float(adm_ago_gs), 2)
                ),
                "delta_nexus_vs_admin_ago": (
                    None
                    if sit_gs is None or adm_ago_gs is None
                    else round(float(sit_gs) - float(adm_ago_gs), 2)
                ),
                "molKey": sit.get("molKey"),
                "fuente_julio": CANON_JUL_PATH,
                "fuente_agosto": CANON_AGO_PATH,
                "fuente_sitfin": sit.get("fuente"),
                "fuente_nexus": sit.get("fuente"),
                "acordeon": bool(sit.get("molKey") and sit["molKey"] in mol),
            }
        )

    con_usd = [
        f
        for f in filas
        if f["julio_base_usd"] is not None and f["agosto_canon_usd"] is not None
    ]
    out = {
        "titulo": "Comparación USD · Julio canon ↔ Agosto canon (admin Guido)",
        "ley": (
            "CANON GUIDO · Solo Z:\\hector\\SF\\07.SITUACION FINANCIERA 01072026.xlsx "
            "vs Z:\\hector\\SF\\08.SITUACION FINANCIERA 01082026.xlsx. "
            "USD vs USD + %. Otros archivos del legajo (SF AL / TXT) pueden tener errores — "
            "toda discrepancia se verifica contra estos dos canones. "
            "NO resultados Nexus operativos."
        ),
        "isla": True,
        "canon": {
            "julio": {
                "path": CANON_JUL_PATH,
                "archivo": CANON_JUL_FILE,
                "tasaUsd": tasa_jul,
            },
            "agosto": {
                "path": CANON_AGO_PATH,
                "archivo": CANON_AGO_FILE,
                "tasaUsd": tasa_ago,
            },
            "regla": "metricas_columnas_solo_entre_canones_admin",
        },
        "comparacion": {
            "modo": "usd_vs_usd_canon_admin",
            "meses": ["2026-07", "2026-08"],
            "tasa_julio": tasa_jul,
            "tasa_agosto": tasa_ago,
            "ui_agosto": "agosto_canon_usd",
            "ui_pct": "pct_usd_canon",
        },
        "base": {
            "mes": "2026-07",
            "corte": jul.get("corte"),
            "archivo": CANON_JUL_FILE,
            "path": CANON_JUL_PATH,
            "tasaUsd": tasa_jul,
            "rol": "canon_julio",
        },
        "actual": {
            "mes": "2026-08",
            "corte_admin": ago_adm.get("corte"),
            "archivo": CANON_AGO_FILE,
            "path": CANON_AGO_PATH,
            "tasaUsd": tasa_ago,
            "rol": "canon_agosto",
            "fuente": "referencia_admin_ago (Excel Guido)",
            "referencia_admin_ago": CANON_AGO_FILE,
            "nota_sitfin": "Sit Fin isla / SF AL 03-08 = auditoría vs canon; no columna % primaria",
        },
        "resumen": {
            "n_conceptos": len(filas),
            "con_pct_usd": sum(1 for f in filas if f["pct_usd_canon"] is not None),
            "con_pct_canon": sum(1 for f in filas if f["pct_usd_canon"] is not None),
            "con_pct_sitfin_vs_jul": sum(
                1 for f in filas if f["pct_usd_sitfin_vs_jul"] is not None
            ),
            "con_pct_nexus_vs_jul": sum(
                1 for f in filas if f["pct_usd_sitfin_vs_jul"] is not None
            ),
            "fidelidad_sitfin_vs_admin_ago_ok": sum(
                1
                for f in filas
                if f.get("delta_sitfin_vs_admin_ago") is not None
                and abs(f["delta_sitfin_vs_admin_ago"]) <= 1
            ),
            "fidelidad_sitfin_vs_admin_ago_total": sum(
                1
                for f in filas
                if f.get("agosto_sitfin_gs") is not None
                and f.get("agosto_admin_gs") is not None
            ),
            "fidelidad_nexus_vs_admin_ago_ok": 0,
            "fidelidad_nexus_vs_admin_ago_total": 0,
            "fidelidad_pct": None,
            "n_pares_usd": len(con_usd),
        },
        "filas": filas,
    }
    ok_fid = out["resumen"]["fidelidad_sitfin_vs_admin_ago_ok"]
    tot_fid = out["resumen"]["fidelidad_sitfin_vs_admin_ago_total"]
    out["resumen"]["fidelidad_nexus_vs_admin_ago_ok"] = ok_fid
    out["resumen"]["fidelidad_nexus_vs_admin_ago_total"] = tot_fid
    out["resumen"]["fidelidad_pct"] = (
        round(100.0 * ok_fid / tot_fid, 1) if tot_fid else None
    )
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        "ok",
        OUT,
        "canon_admin_usd",
        "tasa_jul",
        tasa_jul,
        "tasa_ago",
        tasa_ago,
        "pares_usd",
        len(con_usd),
    )


if __name__ == "__main__":
    main()
