# -*- coding: utf-8 -*-
"""Auditoría financiera: Excel AL vs TXT limpio vs molecular."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PIPE = ROOT / "scripts/situacion-financiera/pipeline"
INTAKE = ROOT / "scripts/situacion-financiera/intake/corte-AL-03-08-26"
STAGING = (
    ROOT
    / "scripts/situacion-financiera/data/catalogo_local/staging"
    / "0d5c8324-e773-4848-b964-6fc3101446be"
)
EXCEL = ROOT / "src/lib/situacion-financiera/excel-al-0308.json"
MOL = ROOT / "src/lib/situacion-financiera/molecular-al-0308.json"
OUT = ROOT / "src/lib/situacion-financiera/audit-mapa-al-0308.json"
OLA2 = ROOT / "src/lib/situacion-financiera/ola2-cuadro-0308.json"
OLA3 = ROOT / "src/lib/situacion-financiera/ola3-pv-prog-0308.json"

sys.path.insert(0, str(PIPE))
from parsers import mes_desde_nombre_cheques, parse_cheques_vencer  # noqa: E402

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


def mes_desde_label(label: str) -> str | None:
    u = (label or "").upper()
    if "HASTA ULTIMO" in u or "ULTIMO VTO" in u:
        return "2027+"
    m = re.search(
        r"\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*(\d{2,4})\b",
        u,
    )
    if not m:
        return None
    yy = m.group(2)
    if len(yy) == 2:
        yy = "20" + yy
    return f"{yy}-{MES_ES[m.group(1)]}"


def dificil_key(label: str) -> str:
    u = " ".join((label or "").upper().split())
    if "TOTAL" in u:
        return "dificil:total"
    if "MAYOR" in u and "180" in u:
        return "dificil:v180p"
    for n, k in [
        (30, "dificil:v30"),
        (60, "dificil:v60"),
        (90, "dificil:v90"),
        (120, "dificil:v120"),
        (150, "dificil:v150"),
        (180, "dificil:v180"),
    ]:
        if f"VENCIDOS A {n}" in u or f"{n} DIA" in u:
            return k
    ym = mes_desde_label(label)
    if ym:
        return f"dificil:{ym}"
    return "dificil:total"


def aging_key(label: str) -> str | None:
    u = " ".join((label or "").upper().split())
    # Difícil cobro ≠ aging OK (otro universo Guido)
    if "DIF" in u and "COBRO" in u:
        return None
    if "MAYOR" in u and "180" in u:
        return "aging:v180p"
    for n, k in [
        (30, "aging:v30"),
        (60, "aging:v60"),
        (90, "aging:v90"),
        (120, "aging:v120"),
        (150, "aging:v150"),
        (180, "aging:v180"),
    ]:
        if f"{n} DIA" in u or f"{n} DÍA" in u or f"A {n}" in u:
            return k
    return None


def load_ola2_gs() -> dict[str, float]:
    """Ola 2 Guido — Cuadro → mol_key → Gs."""
    if not OLA2.exists():
        return {}
    try:
        data = json.loads(OLA2.read_text(encoding="utf-8"))
        return {
            k: float(v["gs"])
            for k, v in (data.get("metricas") or {}).items()
            if v.get("gs") is not None
        }
    except Exception:
        return {}


def load_ola3_gs() -> dict[str, float]:
    """Ola 3 Guido — PV Y PROG → mol_key pv:{ym} → Gs."""
    if not OLA3.exists():
        return {}
    try:
        data = json.loads(OLA3.read_text(encoding="utf-8"))
        return {
            k: float(v["gs"])
            for k, v in (data.get("metricas") or {}).items()
            if v.get("gs") is not None
        }
    except Exception:
        return {}


def main():
    excel = json.loads(EXCEL.read_text(encoding="utf-8"))
    mol = json.loads(MOL.read_text(encoding="utf-8"))
    ola2_gs = load_ola2_gs()
    ola3_gs = load_ola3_gs()
    fac = json.loads((STAGING / "sf_saldo_factura.json").read_text(encoding="utf-8"))
    pv = json.loads((STAGING / "sf_pv_prog.json").read_text(encoding="utf-8"))

    txt_cheques = {}
    for p in sorted(INTAKE.glob("*CHEQUE*")):
        ym = mes_desde_nombre_cheques(p.name) or "?"
        t = parse_cheques_vencer(p)["totales"]
        txt_cheques[ym] = {
            "archivo": p.name,
            "n": t["n"],
            "gs": t["importe_gs"],
        }

    buckets = {
        "aging:v30": (1, 30),
        "aging:v60": (31, 60),
        "aging:v90": (61, 90),
        "aging:v120": (91, 120),
        "aging:v150": (121, 150),
        "aging:v180": (151, 180),
        "aging:v180p": (181, 100000),
    }
    txt_aging = {}
    for k, (lo, hi) in buckets.items():
        s = sum(
            float(f.get("saldo") or 0)
            for f in fac
            if lo <= int(f.get("dias_vencido") or 0) <= hi
        )
        txt_aging[k] = {"gs": s, "n": sum(1 for f in fac if lo <= int(f.get("dias_vencido") or 0) <= hi)}

    filas = []
    ctx = None
    for r in excel["rows"]:
        if r.get("mes"):
            ctx = r["mes"]
        if not ctx and r.get("kind") == "row":
            ctx = "2026-08"
        lab = r.get("label") or ""
        u = lab.upper()
        if r.get("kind") not in ("row", "total_yellow", "reserva"):
            continue

        concepto = None
        mol_key = None
        txt_gs = None
        archivo = None
        origen = None

        if "CHEQUES A VENCER" in u:
            ym = mes_desde_label(lab) or ctx
            mol_key = f"cheques:{ym}"
            concepto = "cheques"
            origen = "txt"
            info = txt_cheques.get(ym)
            if info:
                txt_gs = info["gs"]
                archivo = info["archivo"]
        elif aging_key(lab):
            mol_key = aging_key(lab)
            concepto = "aging"
            origen = "txt"
            txt_gs = txt_aging[mol_key]["gs"]
            archivo = "SALDO CLIENTES DETALLADO AL 03-08.txt"
            if mol_key in ola2_gs:
                txt_gs = ola2_gs[mol_key]
                origen = "ola2_cuadro"
                archivo = "08.SITUACION FINANCIERA 01082026.xlsx · Cuadro · OK+LUISITO"
        elif "SALDO DE CLIENTES" in u and "VENCIDOS" not in u:
            ym = mes_desde_label(lab) or ctx
            mol_key = f"clientes:{ym}" if ym else "clientes:corte"
            concepto = "clientes"
            origen = "excel_prevision"
            txt_gs = None
            archivo = "SF AL 03-08.xlsx (previsión mes; TXT corte ≠ mes proyectado)"
            o2k = f"clientes:{ym}" if ym else None
            if o2k and o2k in ola2_gs:
                txt_gs = ola2_gs[o2k]
                origen = "ola2_cuadro"
                archivo = "08.SITUACION FINANCIERA 01082026.xlsx · Cuadro · OK × mes"
        elif "MERCADER" in u or "PV Y PROG" in u:
            ym = mes_desde_label(lab) or ctx
            mol_key = f"pv:{ym}" if ("PV" in u or "PROG" in u) else f"mercaderia:{ym}"
            if "MERCADER" in u:
                mol_key = f"mercaderia:{ym}"
            concepto = "pv_merc"
            origen = "excel_prevision"
            txt_gs = mol.get(mol_key, {}).get("gs") or mol.get(f"pv:{ym}", {}).get("gs")
            archivo = "SF AL 03-08.xlsx · ref PV Y PROG.txt"
            if "MERCADER" in u and f"mercaderia:{ym}" in ola2_gs:
                txt_gs = ola2_gs[f"mercaderia:{ym}"]
                origen = "ola2_cuadro"
                archivo = "08.SITUACION FINANCIERA 01082026.xlsx · Cuadro · A ENTREGAR"
            elif "PV" in u and f"pv:{ym}" in ola3_gs:
                txt_gs = ola3_gs[f"pv:{ym}"]
                origen = "ola3_pv_prog"
                archivo = "08.SITUACION FINANCIERA 01082026.xlsx · Situacion · PV Y PROG"
        elif "LUISITO" in u:
            concepto = "luisito"
            ym = mes_desde_label(lab) or ctx
            mol_key = f"luisito:{ym}" if ym else "luisito:cuadro"
            o2k = f"luisito:{ym}" if ym else None
            if o2k and o2k in ola2_gs:
                origen = "ola2_cuadro"
                txt_gs = ola2_gs[o2k]
                archivo = "08.SITUACION FINANCIERA 01082026.xlsx · Cuadro · LUISITO"
            else:
                origen = "txt"
                info = mol.get(mol_key) or mol.get("luisito:cuadro")
                if info and info.get("gs") is not None:
                    txt_gs = float(info["gs"])
                archivo = "clientes.xlsx + SALDO CLIENTES DETALLADO AL 03-08.txt (TIPO=LUISITO)"
        elif "DIF" in u and "COBRO" in u:
            concepto = "dificil"
            # Canon: TXT filtrado DIFICIL+SALEMMA cuando hay cruce; mes Excel = previsión
            ym = mes_desde_label(lab) or ctx
            if "TOTAL" in u or any(
                x in u for x in ("30 DIA", "60 DIA", "90 DIA", "120", "150", "180")
            ):
                origen = "txt"
                mol_key = dificil_key(lab)
                info = mol.get(mol_key)
                if info and info.get("gs") is not None:
                    txt_gs = float(info["gs"])
                archivo = "clientes.xlsx + SALDO CLIENTES DETALLADO AL 03-08.txt (DIFICIL/SALEMMA)"
            else:
                origen = "excel_prevision"
                mol_key = dificil_key(lab)
                archivo = "SF AL 03-08.xlsx · bloque DIF.COBRO (proyección mes)"
        elif "SALDO DISPONIBLE" in u:
            concepto = "calc"
            origen = "calc"
        else:
            continue

        excel_gs = r.get("gs")
        if excel_gs is None and r.get("usd") == 0:
            excel_gs = 0.0
        mol_gs = mol.get(mol_key or "", {}).get("gs") if mol_key else None
        canon = txt_gs if txt_gs is not None else excel_gs
        delta = None
        if excel_gs is not None and txt_gs is not None:
            delta = float(excel_gs) - float(txt_gs)

        estado = "ok"
        if origen == "txt":
            if txt_gs is None and (excel_gs is None or excel_gs == 0):
                estado = "sin_txt"
            elif excel_gs is None or excel_gs == 0:
                if txt_gs and txt_gs != 0:
                    estado = "excel_cero_txt_tiene"
                else:
                    estado = "sin_txt"
            elif txt_gs is not None and abs(delta or 0) > 1:
                estado = "descuadre"
            else:
                estado = "ok"
            # Canon financiero documentado = TXT cuando existe
            if txt_gs is not None:
                canon = float(txt_gs)
        elif origen == "manual":
            estado = "manual"
            canon = excel_gs
        elif origen == "excel_prevision":
            estado = "excel_prevision"
            canon = excel_gs
        elif origen == "pendiente":
            estado = "pendiente"
            canon = excel_gs
        elif origen == "calc":
            estado = "calc"
            canon = excel_gs
        elif origen == "ola2_cuadro":
            if txt_gs is not None and excel_gs is not None and abs(float(excel_gs) - float(txt_gs)) <= 1:
                estado = "ola2_ok"
            elif txt_gs is not None:
                estado = "ola2_descuadre"
            else:
                estado = "ola2_pendiente"
            if txt_gs is not None:
                canon = float(txt_gs)
        elif origen == "ola3_pv_prog":
            if txt_gs is not None and excel_gs is not None and abs(float(excel_gs) - float(txt_gs)) <= 1:
                estado = "ola3_ok"
            elif txt_gs is not None:
                estado = "ola3_descuadre"
            else:
                estado = "ola3_pendiente"
            if txt_gs is not None:
                canon = float(txt_gs)

        # SF AL = contexto de grilla (errores conocidos) — NO es Excel de comparativa.
        # Comparativa oficial = canones Z:\hector\SF\07… y 08… (UI alerta-inconsistencia).
        archivo_excel = "SF AL 03-08.xlsx (CONTEXTO · excluido de comparativa)"
        if concepto == "dificil" and origen == "excel_prevision":
            archivo_excel = "SF AL 03-08.xlsx (CONTEXTO · DIF.COBRO · excluido)"
        elif origen == "excel_prevision":
            archivo_excel = "SF AL 03-08.xlsx (CONTEXTO · previsión · excluido)"

        archivo_txt = archivo
        if concepto == "aging":
            archivo_txt = "SALDO CLIENTES DETALLADO AL 03-08.txt"
        elif concepto == "luisito":
            archivo_txt = "clientes.xlsx + SALDO CLIENTES DETALLADO AL 03-08.txt"
        elif concepto == "dificil" and origen == "txt":
            archivo_txt = "clientes.xlsx + SALDO CLIENTES DETALLADO AL 03-08.txt"
        elif concepto == "cheques" and archivo and str(archivo).endswith(".txt"):
            archivo_txt = archivo
        elif concepto in ("clientes", "pv_merc"):
            # Previsión mes · sin TXT de corte = mes → null (nunca SF AL como TXT)
            archivo_txt = None
        elif isinstance(archivo_txt, str) and "SF AL" in archivo_txt.upper():
            archivo_txt = None
        if isinstance(archivo_txt, str) and "SF AL" in archivo_txt.upper():
            archivo_txt = None

        filas.append(
            {
                "r": r["r"],
                "label": lab,
                "mes_ctx": ctx,
                "mes_label": mes_desde_label(lab),
                "concepto": concepto,
                "origen": origen,
                "mol_key": mol_key,
                "excel_gs": excel_gs,
                "txt_gs": txt_gs,
                "mol_gs": mol_gs,
                "canon_gs": canon,
                "delta_excel_minus_txt": delta,
                "archivo": archivo,
                "archivo_excel": archivo_excel,
                "archivo_txt": archivo_txt,
                "estado": estado,
            }
        )

    resumen = {
        "ok": sum(1 for f in filas if f["estado"] == "ok"),
        "descuadre": sum(1 for f in filas if f["estado"] == "descuadre"),
        "excel_cero_txt_tiene": sum(1 for f in filas if f["estado"] == "excel_cero_txt_tiene"),
        "sin_txt": sum(1 for f in filas if f["estado"] == "sin_txt"),
        "manual": sum(1 for f in filas if f["estado"] == "manual"),
        "pendiente": sum(1 for f in filas if f["estado"] == "pendiente"),
        "excel_prevision": sum(1 for f in filas if f["estado"] == "excel_prevision"),
        "ola2_ok": sum(1 for f in filas if f["estado"] == "ola2_ok"),
        "ola2_descuadre": sum(1 for f in filas if f["estado"] == "ola2_descuadre"),
        "ola3_ok": sum(1 for f in filas if f["estado"] == "ola3_ok"),
        "ola3_descuadre": sum(1 for f in filas if f["estado"] == "ola3_descuadre"),
        "calc": sum(1 for f in filas if f["estado"] == "calc"),
    }

    mapa_por_fila = {
        str(f["r"]): {
            "molKey": f["mol_key"],
            "origen": f["origen"],
            "estado": f["estado"],
            "excelGs": f["excel_gs"],
            "txtGs": f["txt_gs"],
            "canonGs": f["canon_gs"],
            "delta": f["delta_excel_minus_txt"],
            "archivo": f["archivo"],
            "archivoExcel": f["archivo_excel"],
            "archivoTxt": f["archivo_txt"],
            "label": f["label"],
        }
        for f in filas
    }
    MAPA = ROOT / "src/lib/situacion-financiera/mapa-canon-al-0308.json"
    MAPA.write_text(
        json.dumps(
            {"corte": "AL-03-08-26", "tasaUsd": excel.get("tasaUsd"), "porFila": mapa_por_fila},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    prev_inv = None
    if OUT.exists():
        try:
            prev_inv = json.loads(OUT.read_text(encoding="utf-8")).get(
                "inventario_intake"
            )
        except Exception:
            prev_inv = None

    report = {
        "corte": "AL-03-08-26",
        "tasaUsd": excel.get("tasaUsd"),
        "txt_cheques": txt_cheques,
        "txt_aging": {k: v["gs"] for k, v in txt_aging.items()},
        "pv_staging_sum": sum(
            float(p.get("Importe_Pedido") or p.get("Importe_Cuota") or 0) for p in pv
        ),
        "resumen": resumen,
        "filas": filas,
        "mapa": str(MAPA.name),
    }
    if prev_inv:
        report["inventario_intake"] = prev_inv
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("RESUMEN", resumen)
    print("\n--- DESCUADRES / EXCEL 0 CON TXT ---")
    for f in filas:
        if f["estado"] in ("descuadre", "excel_cero_txt_tiene", "sin_txt"):
            print(
                f"r{f['r']:3} [{f['estado']:22}] {f['label'][:50]:50} "
                f"excel={f['excel_gs']} txt={f['txt_gs']} key={f['mol_key']}"
            )
    print("\nOK ->", OUT)
    print("MAPA ->", MAPA)


if __name__ == "__main__":
    main()
