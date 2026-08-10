# -*- coding: utf-8 -*-
"""Comparación porcentual Agosto (Nexus) vs Julio (base admin).

Reglas Director:
- Julio = info base (Excel admin ratificado).
- Agosto = primer reporte Nexus (mapa canon + molecular).
- PROHIBIDO ajustar Nexus para forzar igualdad con Excel.
- Delta % = auditable; descuadre se reporta, no se parchae.
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

# Claves Sit Fin mes corriente ↔ molKey / mapa
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

    # Nexus Agosto: preferir canon mapa por molKey; si no, molecular.gs
    nexus_por_concepto: dict[str, dict] = {}
    molkey_to_canon = {}
    for _r, info in por_fila.items():
        mk = info.get("molKey")
        if not mk:
            continue
        molkey_to_canon[mk] = info.get("canonGs")

    for concepto, mk in PUENTE.items():
        gs = molkey_to_canon.get(mk)
        fuente = "mapa_canon"
        if gs is None and mk in mol:
            gs = mol[mk].get("gs")
            fuente = "molecular"
        if gs is None:
            # buscar molKey exacto en mapa
            for info in por_fila.values():
                if info.get("molKey") == mk:
                    gs = info.get("canonGs")
                    fuente = "mapa_canon"
                    break
        # fallback molecular por prefijo banco
        if gs is None and mk.startswith("banco:") and mk in mol:
            gs = mol[mk].get("gs")
            fuente = "molecular"
        nexus_por_concepto[concepto] = {
            "gs": gs,
            "molKey": mk if (mk in mol or gs is not None) else mk,
            "fuente": fuente,
        }

    # Completar desde molecular todas las claves puente
    for concepto, mk in PUENTE.items():
        if nexus_por_concepto[concepto]["gs"] is None and mk in mol:
            nexus_por_concepto[concepto] = {
                "gs": mol[mk].get("gs"),
                "molKey": mk,
                "fuente": "molecular",
            }
        # acordeón si hay árbol
        if mk in mol:
            nexus_por_concepto[concepto]["molKey"] = mk

    filas = []
    base_jul = jul.get("base_mes") or {}
    ref_ago = ago_adm.get("base_mes") or {}

    for concepto, jul_info in sorted(base_jul.items()):
        jul_gs = jul_info.get("gs")
        nexus = nexus_por_concepto.get(concepto) or {}
        ago_gs = nexus.get("gs")
        adm_ago = (ref_ago.get(concepto) or {}).get("gs")
        filas.append(
            {
                "concepto": concepto,
                "label": jul_info.get("label"),
                "julio_base_gs": jul_gs,
                "agosto_nexus_gs": ago_gs,
                "agosto_admin_gs": adm_ago,
                "delta_gs_nexus_vs_jul": (
                    None
                    if ago_gs is None or jul_gs is None
                    else round(ago_gs - jul_gs, 2)
                ),
                "pct_nexus_vs_jul": pct(ago_gs, jul_gs),
                "pct_admin_ago_vs_jul": pct(adm_ago, jul_gs),
                "delta_nexus_vs_admin_ago": (
                    None
                    if ago_gs is None or adm_ago is None
                    else round(ago_gs - adm_ago, 2)
                ),
                "molKey": nexus.get("molKey"),
                "fuente_nexus": nexus.get("fuente"),
                "acordeon": bool(nexus.get("molKey") and nexus["molKey"] in mol),
            }
        )

    # Resumen fidelidad Nexus vs admin Agosto (sin parchear)
    con_ambos = [
        f
        for f in filas
        if f["agosto_nexus_gs"] is not None and f["agosto_admin_gs"] is not None
    ]
    ok_fid = sum(
        1
        for f in con_ambos
        if abs((f["delta_nexus_vs_admin_ago"] or 0)) <= 1
    )
    out = {
        "titulo": "Comparación Agosto Nexus vs Julio base admin",
        "ley": (
            "Julio Excel admin = INFO BASE. Agosto = primer reporte Nexus. "
            "Prohibido copiar Excel ni forzar igualdad. "
            "Descuadre = señal de mapeo a mejorar, no parche."
        ),
        "base": {
            "mes": "2026-07",
            "corte": jul.get("corte"),
            "archivo": jul.get("archivo"),
            "tasaUsd": jul.get("tasaUsd"),
        },
        "actual": {
            "mes": "2026-08",
            "corte_nexus": "2026-08-03",
            "fuente": "mapa-canon-al-0308 + molecular-al-0308",
            "referencia_admin_ago": ago_adm.get("archivo"),
        },
        "resumen": {
            "n_conceptos": len(filas),
            "con_pct_nexus_vs_jul": sum(
                1 for f in filas if f["pct_nexus_vs_jul"] is not None
            ),
            "fidelidad_nexus_vs_admin_ago_ok": ok_fid,
            "fidelidad_nexus_vs_admin_ago_total": len(con_ambos),
            "fidelidad_pct": (
                round(100.0 * ok_fid / len(con_ambos), 1) if con_ambos else None
            ),
        },
        "filas": filas,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        "ok",
        OUT,
        "fid",
        out["resumen"]["fidelidad_pct"],
        "%",
        f"{ok_fid}/{len(con_ambos)}",
    )
    for f in filas:
        if f["concepto"] in ("luisito", "cheques", "aging:v30", "disponible"):
            print(
                f["concepto"],
                "jul",
                f["julio_base_gs"],
                "nx",
                f["agosto_nexus_gs"],
                "adm",
                f["agosto_admin_gs"],
                "pct",
                f["pct_nexus_vs_jul"],
            )


if __name__ == "__main__":
    main()
