# -*- coding: utf-8 -*-
"""Construye/actualiza padrón TXT por programa_erp (Hiedra · Carlos).

Clave = código if* en cabecera (ej. ifcqvg$), NO el nombre del archivo.
Uso:
  python scripts/situacion-financiera/_build_padron_programa_erp.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SF_LIB = ROOT / "src/lib/situacion-financiera"
OUT = SF_LIB / "padron-programa-erp.json"
INTAKE = Path(__file__).resolve().parent / "intake" / "corte-AL-03-08-26"

sys.path.insert(0, str(Path(__file__).resolve().parent / "pipeline"))
from clasificador import clasificar_archivo, cabecera, leer_texto, _programa_erp  # noqa: E402


def normalizar_programa(p: str | None) -> str | None:
    """Conserva el código tal cual Carlos lo escribe (con o sin $)."""
    if not p:
        return None
    return p.strip().lower()


def claves_lookup(prog: str) -> list[str]:
    p = prog.lower()
    out = [p]
    if p.endswith("$"):
        out.append(p[:-1])
    else:
        out.append(p + "$")
    return out


def columnas_desde_cabecera(texto: str) -> list[str]:
    """Busca línea de títulos típica COD.BANCO / NRO.FACTURA etc."""
    for ln in texto.splitlines()[:60]:
        u = ln.upper()
        if "COD.BANCO" in u and "NRO.CHEQUE" in u:
            return [
                "COD.BANCO",
                "NOMBRE DEL BANCO",
                "NRO.CHEQUE",
                "UBICACION",
                "EMITENTE",
                "COD.CLIENTE",
                "FECH.VTO",
                "F.PROC.",
                "F.DEPOS.",
                "F.RECHAZO",
                "IMPORTE",
                "OBSERVACIONES",
            ]
        if "NRO" in u and "FACTURA" in u and ("SALDO" in u or "D.VDOS" in u or "DVDOS" in u):
            return ["(detalle factura — ver parser saldos_detallado)"]
    return []


def main() -> None:
    base = {
        "ley": (
            "Clasificar TXT por programa_erp en cabecera (Hiedra / Carlos), "
            "NO por nombre de archivo. Faro Alejandría agazapado ante variaciones."
        ),
        "fuente": "cabecera RIMEC S.A. · código if* · columnas del listado",
        "actualizado": "2026-08-10",
        "programas": {},
    }
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text(encoding="utf-8"))
            if isinstance(prev.get("programas"), dict):
                base["programas"] = prev["programas"]
        except json.JSONDecodeError:
            pass

    if not INTAKE.is_dir():
        print("FAIL intake", INTAKE)
        sys.exit(1)

    por_prog: dict[str, list] = {}
    for p in sorted(INTAKE.glob("*.txt")):
        c = clasificar_archivo(p)
        prog = normalizar_programa(c.programa_erp) or normalizar_programa(
            _programa_erp(cabecera(leer_texto(p)))
        )
        if not prog:
            # sin if* — registrar como huérfano por tipo
            prog = f"_sin_programa:{c.tipo}"
        por_prog.setdefault(prog, []).append((p.name, c))

    for prog, items in sorted(por_prog.items()):
        tipos = {c.tipo for _, c in items}
        tipo = next(iter(tipos)) if len(tipos) == 1 else "mixto"
        cols = []
        titulo = ""
        for name, c in items:
            texto = leer_texto(Path(c.path))
            if not cols:
                cols = columnas_desde_cabecera(texto)
            head = cabecera(texto, 8)
            for ln in head.splitlines():
                if "LISTADO" in ln.upper() or "INFORME" in ln.upper() or "LIBRO" in ln.upper():
                    titulo = ln.strip()
                    break
            if titulo:
                break

        prev = base["programas"].get(prog, {})
        estado = prev.get("estado_consumo") or (
            "integro" if prog == "ifcqvg$" else "detectado"
        )
        if prog == "ifcqvg$":
            estado = "integro"
            tipo = "cheques_vencer"
            if not cols:
                cols = prev.get("columnas_cabecera") or [
                    "COD.BANCO",
                    "NOMBRE DEL BANCO",
                    "NRO.CHEQUE",
                    "UBICACION",
                    "EMITENTE",
                    "COD.CLIENTE",
                    "FECH.VTO",
                    "F.PROC.",
                    "F.DEPOS.",
                    "F.RECHAZO",
                    "IMPORTE",
                    "OBSERVACIONES",
                ]
            titulo = titulo or "LISTADO DE CHEQUES A VENCER"

        entry = {
            **prev,
            "programa_erp": prog,
            "tipo_codigo": tipo if tipo != "mixto" else prev.get("tipo_codigo"),
            "titulo_informe": titulo or prev.get("titulo_informe") or "",
            "parser_key": prev.get("parser_key")
            or (tipo if tipo != "mixto" else None),
            "estado_consumo": estado,
            "columnas_cabecera": cols or prev.get("columnas_cabecera") or [],
            "archivos_lab_ejemplo": [n for n, _ in items],
            "n_archivos_lab": len(items),
            "notas": prev.get("notas")
            or (
                "Consumo íntegro Faro · manda programa_erp + contenido"
                if estado == "integro"
                else "Detectado por cabecera · listo para mapear"
            ),
        }
        if prog == "ifcqvg$":
            entry["sit_fin_mol_keys"] = prev.get("sit_fin_mol_keys") or [
                "cheques:2026-08",
                "cheques:2026-09",
                "cheques:2026-10",
                "cheques:2026-11",
                "cheques:2026-12",
                "cheques:2027+",
            ]
            entry["filtros_tipicos"] = prev.get("filtros_tipicos") or {
                "UBIC": "//",
                "F.VTO": "rango vencimiento",
                "F.PROC": "rango proceso",
                "marca": "(CHEQUES)",
            }
            entry["notas"] = (
                "Consumo íntegro Faro: Σ líneas limpia = molecular cheques. "
                "Nombre archivo irrelevante; manda ifcqvg$."
            )
        base["programas"][prog] = entry

    OUT.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK", OUT)
    for prog, e in sorted(base["programas"].items()):
        print(
            f"  {prog:20} estado={e.get('estado_consumo'):10} n={e.get('n_archivos_lab')} tipo={e.get('tipo_codigo')}"
        )


if __name__ == "__main__":
    main()
