# -*- coding: utf-8 -*-
"""Ola 2 Guido — Cuadro → Sit Fin filas verdes (segundo reclamo · Comentario General).

Extrae métricas del pivot **Cuadro** del Excel canon Guido 08 y parchea
`molecular-al-0308.json` para que Comparación/Auditoría reflejen proyección por
cuotas (OK / A ENTREGAR / LUISITO × mes), no stock crudo Ola 1.

Reglas (G4/G7/G8 · Comentario General):
  - SALDO DE CLIENTES ago = fila OK × col ago-26
  - MERCADERÍAS ago = fila A ENTREGAR × col ago-26
  - VENCIDOS 30 = OK + LUISITO × col jul-26 (M-1)
  - VENCIDOS 60 = OK + LUISITO × col jun-26 (M-2)
  - PAGO LUISITO ago = fila LUISITO × col ago-26

Fuente canon: Z:\\hector\\SF\\08.SITUACION FINANCIERA 01082026.xlsx · hoja Cuadro
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SF = ROOT / "src/lib/situacion-financiera"
MOL = SF / "molecular-al-0308.json"
OUT = SF / "ola2-cuadro-0308.json"

EXCEL_GUIDO = Path(r"Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx")
TASA = 5970.96

FILAS = ("A ENTREGAR", "OK", "LUISITO")


def _num(v) -> float:
    if v is None or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _usd(gs: float) -> float:
    return round(gs / TASA, 2)


def extraer_cuadro_excel(path: Path) -> dict:
    import openpyxl

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb["Cuadro"]
    rows = list(ws.iter_rows(min_row=1, max_row=40, values_only=True))
    wb.close()

    header = None
    header_idx = None
    for i, row in enumerate(rows):
        if row and row[0] and "Etiquetas de fila" in str(row[0]):
            header = [str(c).strip().lower() if c is not None else "" for c in row]
            header_idx = i
            break
    if not header:
        raise RuntimeError("No se encontró fila encabezado Cuadro (Etiquetas de fila)")

    col_map = {name: idx for idx, name in enumerate(header) if name}

    def col_mes(abrev: str) -> int:
        key = abrev.lower().strip()
        if key not in col_map:
            raise KeyError(f"Columna {abrev!r} no en Cuadro: {list(col_map.keys())}")
        return col_map[key]

    data: dict[str, dict[str, float]] = {}
    for row in rows[header_idx + 1 :]:
        if not row or row[0] is None:
            continue
        fila = str(row[0]).strip().upper()
        if fila not in FILAS:
            continue
        data[fila] = {}
        for name, idx in col_map.items():
            if name in ("etiquetas de fila", "total general"):
                continue
            if idx < len(row):
                data[fila][name] = _num(row[idx])

    def cel(fila: str, mes: str) -> float:
        return data.get(fila, {}).get(mes.lower(), 0.0)

    ago = "ago-26"
    jul = "jul-26"
    jun = "jun-26"

    metricas = {
        "clientes:2026-08": {
            "gs": cel("OK", ago),
            "regla": "G4 · OK × ago-26",
            "fila_cuadro": "OK",
            "columna": ago,
        },
        "mercaderia:2026-08": {
            "gs": cel("A ENTREGAR", ago),
            "regla": "G7 · A ENTREGAR × ago-26",
            "fila_cuadro": "A ENTREGAR",
            "columna": ago,
        },
        "aging:v30": {
            "gs": cel("OK", jul) + cel("LUISITO", jul),
            "regla": "venc30 · {OK,LUISITO} × jul-26",
            "fila_cuadro": "OK+LUISITO",
            "columna": jul,
        },
        "aging:v60": {
            "gs": cel("OK", jun) + cel("LUISITO", jun),
            "regla": "venc60 · {OK,LUISITO} × jun-26",
            "fila_cuadro": "OK+LUISITO",
            "columna": jun,
        },
        "luisito:2026-08": {
            "gs": cel("LUISITO", ago),
            "regla": "G8 · LUISITO × ago-26",
            "fila_cuadro": "LUISITO",
            "columna": ago,
        },
    }
    return {
        "fuente": str(path),
        "hoja": "Cuadro",
        "columnas": {k: v for k, v in col_map.items() if k not in ("etiquetas de fila",)},
        "filas_raw": data,
        "metricas": metricas,
    }


def parchear_molecular(cuadro: dict) -> dict[str, float]:
    mol = json.loads(MOL.read_text(encoding="utf-8"))
    aplicados: dict[str, float] = {}
    fuente = f"Ola2 Cuadro Guido · {cuadro['fuente']}"

    for mol_key, info in cuadro["metricas"].items():
        gs = float(info["gs"])
        aplicados[mol_key] = gs
        prev = mol.get(mol_key, {})
        mol[mol_key] = {
            **prev,
            "id": prev.get("id") or mol_key.replace(":", "-"),
            "label": prev.get("label") or mol_key,
            "gs": gs,
            "usd": _usd(gs),
            "meta": (
                f"Ola 2 · {info['regla']} · {info['fila_cuadro']} × {info['columna']} "
                f"(antes Ola1={prev.get('gs')})"
            ),
            "fuente": fuente,
            "ola2": True,
        }
        if mol_key.startswith("luisito:") and mol_key == "luisito:2026-08":
            mol["luisito:cuadro"] = {
                **mol.get("luisito:cuadro", {}),
                "gs": gs,
                "usd": _usd(gs),
                "meta": f"Ola 2 · celda mes LUISITO · {info['columna']} (acordeón stock Ola1 conservado en children)",
                "fuente": fuente,
                "ola2": True,
            }

    # mercaderia ≠ pv (Guido: no mezclar)
    if "pv:2026-08" in mol and mol["pv:2026-08"].get("gs") == mol.get("mercaderia:2026-08", {}).get("gs"):
        pv = mol["pv:2026-08"]
        mol["mercaderia:2026-08"]["meta"] += " · separado de pv:2026-08"

    MOL.write_text(json.dumps(mol, ensure_ascii=False, indent=2), encoding="utf-8")
    return aplicados


def main() -> None:
    if not EXCEL_GUIDO.exists():
        print("FAIL: Excel Guido no encontrado:", EXCEL_GUIDO, file=sys.stderr)
        raise SystemExit(1)
    if not MOL.exists():
        print("FAIL: molecular ausente — correr _gen_molecular_al.py primero", file=sys.stderr)
        raise SystemExit(1)

    cuadro = extraer_cuadro_excel(EXCEL_GUIDO)
    aplicados = parchear_molecular(cuadro)

    payload = {
        "corte": "AL-03-08-26",
        "ola": 2,
        "actualizado": "2026-08-12",
        "excel_canon": str(EXCEL_GUIDO),
        "pipeline": "TXT → Detalle → TIPO COBRO → Cuadro → Sit Fin verdes",
        "metricas": cuadro["metricas"],
        "aplicados_molecular": aplicados,
        "nota": "PV Y PROG fuera de Ola 2 (Guido: LO VEREMOS LUEGO)",
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("OLA2 OK", OUT)
    for k, gs in aplicados.items():
        print(f"  {k}: {gs:,.0f} Gs")


if __name__ == "__main__":
    main()
