# -*- coding: utf-8 -*-
"""Árbol molecular desde TXT limpios del corte AL — cada Gs con documentación."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PIPE = ROOT / "scripts/situacion-financiera/pipeline"
INTAKE = ROOT / "scripts/situacion-financiera/intake/corte-AL-03-08-26"
STAGING = (
    ROOT
    / "scripts/situacion-financiera/data/catalogo_local/staging"
    / "0d5c8324-e773-4848-b964-6fc3101446be"
)
OUT = ROOT / "src/lib/situacion-financiera/molecular-al-0308.json"
EXCEL = ROOT / "src/lib/situacion-financiera/excel-al-0308.json"
TASA = 5970.96

sys.path.insert(0, str(PIPE))
from parsers import mes_desde_nombre_cheques, parse_cheques_vencer  # noqa: E402


def usd(gs):
    if gs is None:
        return None
    return round(float(gs) / TASA, 2)


def node(id_, label, gs=None, meta=None, children=None, fuente=None, doc=None):
    n = {"id": id_, "label": label}
    if gs is not None:
        n["gs"] = float(gs)
        n["usd"] = usd(gs)
    if meta:
        n["meta"] = meta
    if fuente:
        n["fuente"] = fuente
    if doc:
        n["doc"] = doc
    if children:
        n["children"] = children
    return n


def top_n(items, key, n=20):
    return sorted(items, key=key, reverse=True)[:n]


def mes_cheque_archivo(nombre: str) -> str:
    return mes_desde_nombre_cheques(nombre) or "s/m"


def mes_from_fecha(fe: str) -> str:
    """Acepta YYYYMMDD, YYYY-MM-DD o dd/mm/yyyy."""
    fe = str(fe or "").strip()
    if not fe:
        return "s/m"
    if "/" in fe:
        parts = fe.split("/")
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1].zfill(2)}"
    digits = "".join(c for c in fe if c.isdigit())
    if len(digits) >= 8:
        return f"{digits[:4]}-{digits[4:6]}"
    if len(fe) >= 7 and fe[4] == "-":
        return fe[:7]
    return "s/m"


def build_cheques_from_txt() -> dict:
    """Mes → día vto → banco → cheque (TXT limpio completo, sin truncar)."""
    out = {}
    files = sorted(INTAKE.glob("*CHEQUES*.txt"))
    by_mes: dict[str, list] = defaultdict(list)
    for path in files:
        parsed = parse_cheques_vencer(path)
        ym = mes_cheque_archivo(path.name)
        for f in parsed["filas"]:
            if f.get("Moneda") != "Gs":
                continue
            by_mes[ym].append(f)

    for mes, rows in sorted(by_mes.items()):
        by_dia: dict[str, list] = defaultdict(list)
        for r in rows:
            by_dia[r.get("Fecha_Vto") or "?"].append(r)
        dia_nodes = []
        for dia, items in sorted(by_dia.items(), key=lambda x: x[0]):
            by_banco: dict[str, list] = defaultdict(list)
            for r in items:
                key = f"{r.get('Banco_Cod')}|{r.get('Banco_Nombre') or ''}"
                by_banco[key].append(r)
            banco_nodes = []
            for bkey, cheqs in sorted(
                by_banco.items(),
                key=lambda x: -sum(int(c["Importe"]) for c in x[1]),
            ):
                cod, nom = bkey.split("|", 1)
                leaves = [
                    node(
                        f"ch-{mes}-{dia}-{cod}-{c['Nro_Cheque']}-{i}",
                        f"Cheque {c['Nro_Cheque']} · {c.get('Emitente') or 's/emitente'} · cli {c.get('Cod_Cliente')}",
                        c["Importe"],
                        meta=f"vto {c.get('Fecha_Vto')} · proc {c.get('Fecha_Proc')} · {c.get('Moneda')} · línea TXT #{c.get('Nro_Linea')}",
                        fuente=c.get("Fuente"),
                        doc=c.get("Linea_Limpia"),
                    )
                    for i, c in enumerate(
                        sorted(cheqs, key=lambda x: -int(x["Importe"]))
                    )
                ]
                banco_nodes.append(
                    node(
                        f"banco-{mes}-{dia}-{cod}",
                        f"{cod} · {nom or 'banco'}",
                        sum(int(c["Importe"]) for c in cheqs),
                        meta=f"{len(cheqs)} cheques · TXT limpio",
                        children=leaves,
                        fuente=cheqs[0].get("Fuente") if cheqs else None,
                    )
                )
            dia_nodes.append(
                node(
                    f"dia-{mes}-{dia}",
                    f"Vence {dia}",
                    sum(int(c["Importe"]) for c in items),
                    meta=f"{len(items)} cheques · subtotal día (como listado ERP)",
                    children=banco_nodes,
                )
            )
        archivos = sorted({r.get("Fuente") for r in rows if r.get("Fuente")})
        out[f"cheques:{mes}"] = node(
            f"cheques-{mes}",
            f"Cheques a vencer {mes}",
            sum(int(c["Importe"]) for c in rows),
            meta=f"{len(rows)} cheques · Σ Gs respaldada 100% por líneas TXT",
            children=dia_nodes,
            fuente=" · ".join(archivos),
        )
    return out


def load_staging(name: str):
    p = STAGING / name
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


def build_clientes_facturas() -> dict:
    """Cliente → factura (staging desde TXT saldos)."""
    facturas = load_staging("sf_saldo_factura.json")
    clientes = load_staging("sf_saldo_cliente.json")
    fac_by_cli = defaultdict(list)
    for f in facturas:
        fac_by_cli[str(f.get("cod_cliente") or "")].append(f)

    cli_nodes = []
    for c in top_n(clientes, lambda x: abs(float(x.get("saldo") or 0)), 50):
        cod = str(c.get("cod_cliente") or "")
        facs = sorted(
            fac_by_cli.get(cod, []),
            key=lambda x: abs(float(x.get("saldo") or 0)),
            reverse=True,
        )
        children = [
            node(
                f"fac-{cod}-{i}-{fac.get('nro_factura')}",
                f"Factura {fac.get('nro_factura')}",
                fac.get("saldo"),
                meta=f"días {fac.get('dias_vencido')} · {fac.get('nombre') or ''}",
                fuente=fac.get("archivo"),
                doc=f"factura={fac.get('nro_factura')} cli={cod} saldo={fac.get('saldo')} dias={fac.get('dias_vencido')} · TXT {fac.get('archivo')}",
            )
            for i, fac in enumerate(facs)
        ]
        cli_nodes.append(
            node(
                f"cli-{cod}",
                f"{cod} · {c.get('nombre') or 'sin nombre'}",
                c.get("saldo"),
                meta=str(c.get("moneda") or ""),
                children=children or None,
                fuente=c.get("archivo") or "sf_saldo_cliente",
            )
        )

    root = node(
        "clientes-corte",
        "Saldo clientes (TXT limpio)",
        sum(float(c.get("saldo") or 0) for c in clientes),
        meta=f"{len(clientes)} clientes · {len(facturas)} facturas",
        children=cli_nodes,
        fuente="SALDO CLIENTES*.txt",
    )

    buckets = {
        "v30": (1, 30),
        "v60": (31, 60),
        "v90": (61, 90),
        "v120": (91, 120),
        "v150": (121, 150),
        "v180": (151, 180),
        "v180p": (181, 10_000),
    }
    aging = {}
    for key, (lo, hi) in buckets.items():
        rows = [f for f in facturas if lo <= int(f.get("dias_vencido") or 0) <= hi]
        by_cli = defaultdict(list)
        for f in rows:
            by_cli[str(f.get("cod_cliente"))].append(f)
        children = []
        for cod, facs in top_n(
            list(by_cli.items()),
            lambda x: sum(abs(float(f.get("saldo") or 0)) for f in x[1]),
            40,
        ):
            gs = sum(float(f.get("saldo") or 0) for f in facs)
            children.append(
                node(
                    f"aging-{key}-{cod}",
                    f"Cliente {cod}",
                    gs,
                    children=[
                        node(
                            f"aging-{key}-{cod}-{i}-{fac.get('nro_factura')}",
                            f"Factura {fac.get('nro_factura')}",
                            fac.get("saldo"),
                            meta=f"{fac.get('dias_vencido')} d",
                            fuente=fac.get("archivo"),
                            doc=f"factura={fac.get('nro_factura')} cli={cod} saldo={fac.get('saldo')} · TXT {fac.get('archivo')}",
                        )
                        for i, fac in enumerate(
                            sorted(facs, key=lambda x: -abs(float(x.get("saldo") or 0)))
                        )
                    ],
                )
            )
        aging[f"aging:{key}"] = node(
            f"aging-{key}",
            f"Vencidos {key}",
            sum(float(f.get("saldo") or 0) for f in rows),
            meta=f"{len(rows)} facturas · TXT saldos detallado",
            children=children,
            fuente="SALDO CLIENTES DETALLADO*.txt",
        )

    index = {"clientes:corte": root, **aging}
    for mes in ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]:
        index[f"clientes:{mes}"] = node(
            f"clientes-{mes}",
            f"Saldo clientes {mes}",
            root.get("gs"),
            meta="Proxy corte (explosión cuotas Guido pendiente) · mismas facturas TXT",
            children=cli_nodes,
            fuente="SALDO CLIENTES*.txt",
        )
    return index


def build_pv() -> dict:
    pv = load_staging("sf_pv_prog.json")
    by_mes = defaultdict(list)
    for p in pv:
        by_mes[mes_from_fecha(p.get("Fecha_Entrega"))].append(p)
    out = {}
    for mes, rows in sorted(by_mes.items()):
        by_cli = defaultdict(list)
        for p in rows:
            by_cli[str(p.get("Cod_Cliente") or "?")].append(p)
        cli_kids = []
        for cod, items in sorted(
            by_cli.items(),
            key=lambda x: -sum(
                float(i.get("Importe_Pedido") or i.get("Importe_Cuota") or 0) for i in x[1]
            ),
        ):
            kids = [
                node(
                    f"pv-{mes}-{cod}-{i}-{p.get('Nro_Ped_Prov')}",
                    f"Ped.prov {p.get('Nro_Ped_Prov')} · PF {p.get('Proforma')}",
                    p.get("Importe_Pedido") or p.get("Importe_Cuota"),
                    meta=f"entrega {p.get('Fecha_Entrega')} · cuotas {p.get('Cant_Cuotas')}",
                    fuente=p.get("Fuente") or "PV Y PROG.txt",
                    doc=f"ped={p.get('Nro_Ped_Prov')} pf={p.get('Proforma')} cli={cod} importe={p.get('Importe_Pedido') or p.get('Importe_Cuota')} · TXT PV Y PROG",
                )
                for i, p in enumerate(
                    sorted(
                        items,
                        key=lambda x: -abs(
                            float(x.get("Importe_Pedido") or x.get("Importe_Cuota") or 0)
                        ),
                    )
                )
            ]
            tot = sum(float(i.get("Importe_Pedido") or i.get("Importe_Cuota") or 0) for i in items)
            cli_kids.append(
                node(f"pv-cli-{mes}-{cod}", f"Cliente {cod}", tot, meta=f"{len(items)} líneas", children=kids)
            )
        out[f"pv:{mes}"] = node(
            f"pv-{mes}",
            f"PV y PROG {mes}",
            sum(float(i.get("Importe_Pedido") or i.get("Importe_Cuota") or 0) for i in rows),
            meta=f"{len(rows)} líneas · TXT limpio",
            children=cli_kids,
            fuente="PV Y PROG.txt",
        )
        out[f"mercaderia:{mes}"] = out[f"pv:{mes}"]
    return out


def build_bancos_manual() -> dict:
    # Bancos = MANUAL Excel (no vienen del TXT cheques). Documentar explícito.
    specs = [
        ("banco:CONTINENTAL:USD", "Banco Continental USD", 925101193.7736),
        ("banco:CONTINENTAL:GS", "Banco Continental Gs", 1718236201.0),
        ("banco:ITAU:GS", "Banco Itaú Gs", 359782579.0),
        ("banco:BANCOOP:USD", "Bancoop USD", 2352986596.6704),
        ("banco:BANCOOP:GS", "Bancoop Gs", 990211535.0),
        ("banco:GNB:GS", "GNB Gs", 10000000.0),
        ("banco:BNF:GS", "BNF Gs", 15006624.0),
    ]
    out = {}
    for k, lab, gs in specs:
        out[k] = node(
            k.replace(":", "-"),
            lab,
            gs,
            meta="MANUAL Excel — no hay TXT extracto bancario en intake; no desglose molecular ERP",
            children=[
                node(
                    f"{k}-leaf",
                    "Importe planilla SF AL (sin respaldo TXT)",
                    gs,
                    doc="Sin Linea_Limpia: saldo de banco se carga a mano en Excel.",
                )
            ],
            fuente="SF AL 03-08.xlsx · MANUAL",
        )
    egresos = {
        "manual:PAGO A PROVEEDORES": (-280266114.672, "PAGO A PROVEEDORES"),
        "manual:GASTOS DE DESPACHO": (-115000000.0, "GASTOS DE DESPACHO"),
        "manual:PREVISION GASTOS OPERATIVOS": (-2338191000.0, "PREVISION GASTOS OPERATIVOS"),
        "manual:PRESTAMO BANCARIO": (-157000000.0, "PRESTAMO BANCARIO"),
    }
    for k, (gs, lab) in egresos.items():
        out[k] = node(
            k.replace(":", "-"),
            lab,
            gs,
            meta="MANUAL Excel — respaldo = planilla / comprobante, no TXT listado ERP",
            children=[
                node(f"{k}-leaf", "Importe planilla", gs, doc=f"Manual Excel · {lab}")
            ],
            fuente="SF AL · MANUAL",
        )
    out["bazzar:manual"] = node(
        "bazzar",
        "Pagos Bazzar",
        1_300_000_000.0,
        meta="MANUAL · VTO.BAZZAR previsión ago-26",
        children=[
            node(
                "bazzar-ago",
                "Previsión agosto 2026",
                1_300_000_000.0,
                doc="VTO.BAZZAR AGOSTO26.xlsx · hoja PREVISION PAGOS BAZZAR26 · 2026-08 = 1.300.000.000",
            )
        ],
        fuente="VTO.BAZZAR AGOSTO26.xlsx",
    )
    out["luisito:cuadro"] = node(
        "luisito",
        "Pago Luisito",
        None,
        meta="Verde cuadro Guido — detalle auditable cuotas",
        children=[
            node("luisito-1", "Pendiente cablear cuadro→TXT", None, doc="Fuente: detalle_auditable CSV Guido")
        ],
        fuente="cuadro_vencimientos",
    )
    return out


def _dificil_key_from_label(label: str) -> str | None:
    u = " ".join((label or "").upper().split())
    if "DIF" not in u or "COBRO" not in u:
        return None
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
    # Mes embebido tipo AGOSTO 26 / SETIEMBRE 26
    m = re.search(
        r"\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*(\d{2,4})\b",
        u,
    )
    if not m:
        return "dificil:total"
    mes_es = {
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
    yy = m.group(2)
    if len(yy) == 2:
        yy = "20" + yy
    return f"dificil:{yy}-{mes_es[m.group(1)]}"


def build_dificil_excel() -> dict:
    """Buckets DIF.COBRO desde Excel AL (naranja) — no inventar filtro TXT."""
    excel = json.loads(EXCEL.read_text(encoding="utf-8"))
    out = {}
    for r in excel.get("rows") or []:
        if r.get("kind") not in ("row", "total_gray"):
            continue
        lab = r.get("label") or ""
        key = _dificil_key_from_label(lab)
        if not key:
            continue
        gs = r.get("gs")
        if gs is None:
            continue
        out[key] = node(
            key.replace(":", "-"),
            lab,
            float(gs),
            meta="Excel Sit Fin · DIF.COBRO (Guido) — sin líneas TXT filtradas DIFICIL/SALEMMA",
            children=[
                node(
                    f"{key}-excel",
                    "Importe celda Excel",
                    float(gs),
                    doc=f"SF AL 03-08.xlsx · fila {r.get('r')} · {lab}",
                )
            ],
            fuente="SF AL 03-08.xlsx",
        )
    return out


def main():
    index = {}
    index.update(build_cheques_from_txt())
    index.update(build_clientes_facturas())
    index.update(build_pv())
    index.update(build_bancos_manual())
    index.update(build_dificil_excel())
    for mes in ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]:
        index.setdefault(
            f"cheques:{mes}",
            node(f"cheques-empty-{mes}", f"Cheques {mes}", 0, meta="sin TXT en intake"),
        )
        index.setdefault(
            f"pv:{mes}",
            node(f"pv-empty-{mes}", f"PV {mes}", 0, meta="sin filas"),
        )
        index.setdefault(f"mercaderia:{mes}", index[f"pv:{mes}"])

    OUT.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    ch = index.get("cheques:2026-08")
    print(
        "ok",
        OUT,
        "keys",
        len(index),
        "bytes",
        OUT.stat().st_size,
        "cheques_ago_n",
        ch.get("meta") if ch else None,
        "gs",
        ch.get("gs") if ch else None,
    )


if __name__ == "__main__":
    main()
