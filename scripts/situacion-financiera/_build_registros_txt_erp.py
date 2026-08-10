# -*- coding: utf-8 -*-
"""Registra TXT ERP con cabecera completa → registros-txt-erp.json + padrón.

  python scripts/situacion-financiera/_build_registros_txt_erp.py
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SF_LIB = ROOT / "src/lib/situacion-financiera"
OUT = SF_LIB / "registros-txt-erp.json"
PADRON = SF_LIB / "padron-programa-erp.json"
INTAKE = Path(__file__).resolve().parent / "intake" / "corte-AL-03-08-26"

sys.path.insert(0, str(Path(__file__).resolve().parent / "pipeline"))
from cabecera_meta import parse_cabecera_meta  # noqa: E402
from clasificador import clasificar_archivo, leer_texto  # noqa: E402

# Qué requiere Sit Fin (Faro) vs control
REQUERIDO_SF = {
    "cheques_vencer": {
        "rol": "requerido_sf",
        "objetivo": "Filas CHEQUES A VENCER · molecular por mes",
        "color_ui": "verde",
    },
    "saldos_detallado": {
        "rol": "requerido_sf",
        "objetivo": "Aging / CxC detallado · Luisito · DIFICIL",
        "color_ui": "verde",
    },
    "saldos_resumen": {
        "rol": "apoyo_sf",
        "objetivo": "Control Σ clientes (mes = cuadro Guido)",
        "color_ui": "verde",
    },
    "pv_prog": {
        "rol": "apoyo_sf",
        "objetivo": "Ref PV Y PROG / mercadería (subconjunto Guido)",
        "color_ui": "verde",
    },
    "ventas_bzz": {
        "rol": "candidato_manual",
        "objetivo": "Candidato a reemplazar PAGOS BAZZAR (naranja)",
        "color_ui": "naranja_futuro",
    },
    "ventas_mensuales": {
        "rol": "control",
        "objetivo": "Control libro ventas · no mueve celda SF aún",
        "color_ui": "control",
    },
    "ventas_dto": {
        "rol": "control",
        "objetivo": "Control facturas con descuento",
        "color_ui": "control",
    },
    "ventas_dia": {
        "rol": "control",
        "objetivo": "Control ventas por día",
        "color_ui": "control",
    },
}


def normalizar_prog(p: str | None) -> str | None:
    if not p:
        return None
    p = p.strip().lower()
    return "ifcqvg$" if p == "ifcqvg" else p


def main() -> None:
    if not INTAKE.is_dir():
        print("FAIL", INTAKE)
        sys.exit(1)

    registros = []
    por_programa: dict[str, list] = {}

    for p in sorted(INTAKE.glob("*.txt")):
        c = clasificar_archivo(p)
        texto = leer_texto(p)
        meta = parse_cabecera_meta(texto)
        prog = normalizar_prog(meta.get("programa_erp") or c.programa_erp)
        tipo = c.tipo
        req = REQUERIDO_SF.get(
            tipo,
            {
                "rol": "detectado",
                "objetivo": "Detectado · mapear",
                "color_ui": "control",
            },
        )
        rec = {
            "archivo": p.name,
            "bytes": p.stat().st_size,
            "programa_erp": prog,
            "tipo_codigo": tipo,
            "confianza": c.confianza,
            "titulo_informe": meta.get("titulo_informe") or c.notas,
            "fecha_emision": meta.get("fecha_emision"),
            "hora_emision": meta.get("hora_emision"),
            "pagina": meta.get("pagina"),
            "filtros": meta.get("filtros") or {},
            "cabecera_cruda": meta.get("cabecera_cruda"),
            "rol_sf": req["rol"],
            "objetivo_sf": req["objetivo"],
            "color_ui": req["color_ui"],
            "requerido_para_sf": req["rol"] in ("requerido_sf", "apoyo_sf"),
            "estado_consumo": (
                "integro"
                if tipo in ("cheques_vencer", "saldos_detallado")
                else "detectado"
                if req["rol"] == "control"
                else "mapeado"
            ),
        }
        registros.append(rec)
        if prog:
            por_programa.setdefault(prog, []).append(rec["archivo"])

    n_req = sum(1 for r in registros if r["requerido_para_sf"])
    n_ctrl = sum(1 for r in registros if not r["requerido_para_sf"])

    out = {
        "corte": "AL-03-08-26",
        "actualizado": date.today().isoformat(),
        "ley": (
            "Registros TXT Faro · clave = programa_erp (Carlos/Hiedra) + cabecera "
            "(fecha emisión, hora, filtros). Nombre de archivo = etiqueta humana."
        ),
        "resumen": {
            "n_txt": len(registros),
            "n_requeridos_sf": n_req,
            "n_control_o_candidato": n_ctrl,
            "n_programas": len(por_programa),
            "programas": sorted(por_programa.keys()),
        },
        "por_programa": {
            k: {"n": len(v), "archivos": v} for k, v in sorted(por_programa.items())
        },
        "registros": registros,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK", OUT, "txt=", len(registros), "req_sf=", n_req)

    # Enriquecer padrón con última cabecera tipo
    if PADRON.exists():
        pad = json.loads(PADRON.read_text(encoding="utf-8"))
        progs = pad.setdefault("programas", {})
        for r in registros:
            prog = r.get("programa_erp")
            if not prog or prog.startswith("_"):
                continue
            e = progs.get(prog, {"programa_erp": prog})
            e["programa_erp"] = prog
            e["tipo_codigo"] = r["tipo_codigo"]
            e["titulo_informe"] = r.get("titulo_informe") or e.get("titulo_informe")
            e.setdefault("estado_consumo", r.get("estado_consumo"))
            if r["tipo_codigo"] == "cheques_vencer":
                e["estado_consumo"] = "integro"
            e["ultima_cabecera"] = {
                "fecha_emision": r.get("fecha_emision"),
                "hora_emision": r.get("hora_emision"),
                "pagina": r.get("pagina"),
                "filtros": r.get("filtros"),
                "archivo_ejemplo": r.get("archivo"),
            }
            archivos = list(
                dict.fromkeys(
                    (e.get("archivos_lab_ejemplo") or []) + [r["archivo"]]
                )
            )
            e["archivos_lab_ejemplo"] = archivos
            e["n_archivos_lab"] = len(archivos)
            progs[prog] = e
        # quitar ifcqvg sin $
        if "ifcqvg" in progs and "ifcqvg$" in progs:
            del progs["ifcqvg"]
        pad["actualizado"] = date.today().isoformat()
        PADRON.write_text(
            json.dumps(pad, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print("OK padrón enriquecido", PADRON)


if __name__ == "__main__":
    main()
