# -*- coding: utf-8 -*-
"""Comparación porcentual Agosto Sit Fin (isla TXT/mapa) vs Julio (base admin).

ISLA 2.3.1.50.12: no son «resultados Nexus». Son mapeo del módulo Sit Fin
(intake propio). Prohibido parchear ni integrar módulos Nexus operativos.
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
    # Tasa Agosto predeterminada del corte Sit Fin / admin Ago
    tasa_ago = float(ago_adm.get("tasaUsd") or 5970.96)

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
        sit = sitfin_por_concepto.get(concepto) or {}
        ago_gs = sit.get("gs")
        # Agosto Sit Fin: USD con tasa predeterminada del corte Agosto (isla)
        ago_usd = None
        if ago_gs is not None and tasa_ago:
            ago_usd = round(float(ago_gs) / tasa_ago, 2)
        # Admin Ago solo auditoría interna (no UI primaria)
        adm_ago = (ref_ago.get(concepto) or {}).get("gs")
        adm_ago_usd = (ref_ago.get(concepto) or {}).get("usd")
        p_usd = pct(ago_usd, jul_usd)
        p_gs = pct(ago_gs, jul_gs)
        filas.append(
            {
                "concepto": concepto,
                "label": jul_info.get("label"),
                "julio_base_gs": jul_gs,
                "julio_base_usd": jul_usd,
                "agosto_sitfin_gs": ago_gs,
                "agosto_sitfin_usd": ago_usd,
                "agosto_nexus_gs": ago_gs,
                "agosto_admin_gs": adm_ago,
                "agosto_admin_usd": adm_ago_usd,
                "delta_usd_sitfin_vs_jul": (
                    None
                    if ago_usd is None or jul_usd is None
                    else round(ago_usd - jul_usd, 2)
                ),
                "pct_usd_sitfin_vs_jul": p_usd,
                "pct_sitfin_vs_jul": p_usd if p_usd is not None else p_gs,
                "pct_nexus_vs_jul": p_usd if p_usd is not None else p_gs,
                "pct_admin_ago_vs_jul": pct(adm_ago, jul_gs),
                "delta_gs_sitfin_vs_jul": (
                    None
                    if ago_gs is None or jul_gs is None
                    else round(ago_gs - jul_gs, 2)
                ),
                "delta_gs_nexus_vs_jul": (
                    None
                    if ago_gs is None or jul_gs is None
                    else round(ago_gs - jul_gs, 2)
                ),
                "delta_sitfin_vs_admin_ago": (
                    None
                    if ago_gs is None or adm_ago is None
                    else round(ago_gs - adm_ago, 2)
                ),
                "delta_nexus_vs_admin_ago": (
                    None
                    if ago_gs is None or adm_ago is None
                    else round(ago_gs - adm_ago, 2)
                ),
                "molKey": sit.get("molKey"),
                "fuente_sitfin": sit.get("fuente"),
                "fuente_nexus": sit.get("fuente"),
                "acordeon": bool(sit.get("molKey") and sit["molKey"] in mol),
            }
        )

    con_usd = [
        f
        for f in filas
        if f["julio_base_usd"] is not None and f["agosto_sitfin_usd"] is not None
    ]
    out = {
        "titulo": "Comparación USD · Julio base ↔ Agosto Sit Fin (isla)",
        "ley": (
            "ISLA 2.3.1.50.12 · Solo campos Julio vs Agosto. "
            "Comparación en USD (tasa Julio + tasa Agosto predeterminadas del corte). "
            "USD vs USD + %. NO resultados Nexus operativos."
        ),
        "isla": True,
        "comparacion": {
            "modo": "usd_vs_usd",
            "meses": ["2026-07", "2026-08"],
            "tasa_julio": tasa_jul,
            "tasa_agosto": tasa_ago,
        },
        "base": {
            "mes": "2026-07",
            "corte": jul.get("corte"),
            "archivo": jul.get("archivo"),
            "tasaUsd": tasa_jul,
        },
        "actual": {
            "mes": "2026-08",
            "corte_sitfin": "2026-08-03",
            "corte_nexus": "2026-08-03",
            "fuente": "mapa-canon + molecular (isla Sit Fin)",
            "referencia_admin_ago": ago_adm.get("archivo"),
            "tasaUsd": tasa_ago,
        },
        "resumen": {
            "n_conceptos": len(filas),
            "con_pct_usd": sum(
                1 for f in filas if f["pct_usd_sitfin_vs_jul"] is not None
            ),
            "con_pct_sitfin_vs_jul": sum(
                1 for f in filas if f["pct_sitfin_vs_jul"] is not None
            ),
            "con_pct_nexus_vs_jul": sum(
                1 for f in filas if f["pct_sitfin_vs_jul"] is not None
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
    # fidelidad admin (auditoría) — no es la comparación UI
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
        "usd_vs_usd",
        "tasa_jul",
        tasa_jul,
        "tasa_ago",
        tasa_ago,
        "pares_usd",
        len(con_usd),
    )


if __name__ == "__main__":
    main()
