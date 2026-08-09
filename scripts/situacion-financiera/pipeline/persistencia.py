# -*- coding: utf-8 -*-
"""Persistencia SF T01–T12: catálogo local JSON + opcional Postgres (Supabase LAB).

Sin credenciales: escribe en data/catalogo_local/ y cortes en salida del run.
Con --supabase + DATABASE_URL / SUPABASE_DB_URL: inserta en tablas sf_*.
"""
from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "catalogo_local"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_huella(h: str) -> str:
    return " ".join((h or "").split())[:240]


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class CatalogoLocal:
    def __init__(self, root: Path | None = None):
        self.root = root or DATA_DIR
        self.root.mkdir(parents=True, exist_ok=True)
        self.tipos_path = self.root / "tipos.json"
        self.huellas_path = self.root / "huellas.json"
        self.eventos_path = self.root / "eventos.jsonl"
        self.cortes_dir = self.root / "cortes"
        self.cortes_dir.mkdir(exist_ok=True)
        self.tipos = self._load_json(self.tipos_path, {})
        self.huellas = self._load_json(self.huellas_path, {})  # tipo -> list[{huella_norm, programa}]

    @staticmethod
    def _load_json(path: Path, default):
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))

    def save_catalogo(self) -> None:
        self.tipos_path.write_text(
            json.dumps(self.tipos, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self.huellas_path.write_text(
            json.dumps(self.huellas, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def ensure_tipo(self, codigo: str, columnas: list[str] | None = None) -> None:
        if codigo not in self.tipos:
            self.tipos[codigo] = {
                "codigo": codigo,
                "parser_version": 1,
                "columnas_esperadas": columnas or [],
                "activo": True,
            }
        elif columnas is not None and not self.tipos[codigo].get("columnas_esperadas"):
            self.tipos[codigo]["columnas_esperadas"] = columnas

    def aprobar_huella(self, tipo: str, huella: str, programa: str | None = None) -> None:
        self.ensure_tipo(tipo)
        norm = _norm_huella(huella)
        lst = self.huellas.setdefault(tipo, [])
        if not any(x.get("huella_norm") == norm for x in lst):
            lst.append(
                {
                    "huella_norm": norm,
                    "programa_erp": programa,
                    "aprobado": True,
                    "created_at": _now_iso(),
                }
            )

    def huella_conocida(self, tipo: str, huella: str) -> bool:
        norm = _norm_huella(huella)
        return any(x.get("huella_norm") == norm and x.get("aprobado", True) for x in self.huellas.get(tipo, []))

    _META_COLS = frozenset({"Fuente", "archivo", "Fuente_Archivo"})

    def verificar_archivo(
        self, *, tipo: str, huella: str, columnas: list[str], programa: str | None
    ) -> list[dict[str, Any]]:
        eventos: list[dict[str, Any]] = []
        if tipo == "desconocido" or tipo not in self.tipos:
            eventos.append(
                {
                    "clase": "tipo_nuevo" if tipo != "desconocido" else "desconocido",
                    "severidad": "alta",
                    "detalle": {"tipo": tipo, "programa_erp": programa},
                    "decision": "pendiente",
                }
            )
        if tipo != "desconocido" and not self.huella_conocida(tipo, huella):
            eventos.append(
                {
                    "clase": "huella_nueva",
                    "severidad": "media",
                    "detalle": {
                        "tipo": tipo,
                        "huella": _norm_huella(huella),
                        "programa_erp": programa,
                    },
                    "decision": "pendiente",
                }
            )
        esp = set(self.tipos.get(tipo, {}).get("columnas_esperadas") or []) - self._META_COLS
        det = set(columnas or []) - self._META_COLS
        if esp and det:
            nuevas = sorted(det - esp)
            ausentes = sorted(esp - det)
            if nuevas:
                eventos.append(
                    {
                        "clase": "columna_nueva",
                        "severidad": "media",
                        "detalle": {"tipo": tipo, "columnas": nuevas},
                        "decision": "pendiente",
                    }
                )
            if ausentes:
                eventos.append(
                    {
                        "clase": "columna_ausente",
                        "severidad": "baja",
                        "detalle": {"tipo": tipo, "columnas": ausentes},
                        "decision": "pendiente",
                    }
                )
        return eventos

    def append_evento_log(self, corte_batch: str, eventos: list[dict]) -> None:
        with self.eventos_path.open("a", encoding="utf-8") as f:
            for ev in eventos:
                f.write(
                    json.dumps({"batch_id": corte_batch, **ev, "created_at": _now_iso()}, ensure_ascii=False)
                    + "\n"
                )

    def guardar_corte(self, corte: dict) -> Path:
        batch = corte["batch_id"]
        path = self.cortes_dir / f"{batch}.json"
        path.write_text(json.dumps(corte, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return path


def persistir_corte_local(
    *,
    catalogo: CatalogoLocal,
    fecha_al: date,
    tasa_usd: float,
    carpeta: str,
    clasifs: list[Any],
    parsed_by_name: dict[str, dict],
    cheques_por_mes: dict[str, int],
    aging: dict[str, int],
    pv_prog_por_mes: dict[str, int],
    manuales: dict,
    auto_aprobar_huellas: bool = False,
) -> dict[str, Any]:
    batch_id = str(uuid.uuid4())
    archivos = []
    all_eventos: list[dict] = []
    staging: dict[str, list] = {
        "sf_cheque_vencer": [],
        "sf_saldo_cliente": [],
        "sf_saldo_factura": [],
        "sf_pv_prog": [],
        "sf_venta_erp": [],
        "sf_manual_linea": [],
        "sf_sit_fin_linea": [],
    }

    for c in clasifs:
        path = Path(c.path)
        data = parsed_by_name.get(c.nombre, {})
        filas = data.get("filas") or []
        columnas = list(filas[0].keys()) if filas else []
        catalogo.ensure_tipo(c.tipo, columnas if c.tipo in (
            "cheques_vencer", "saldos_resumen", "saldos_detallado", "saldos", "pv_prog"
        ) else None)
        eventos = catalogo.verificar_archivo(
            tipo=c.tipo, huella=c.huella, columnas=columnas, programa=c.programa_erp
        )
        if auto_aprobar_huellas and c.tipo != "desconocido":
            catalogo.aprobar_huella(c.tipo, c.huella, c.programa_erp)
            eventos = [e for e in eventos if e["clase"] not in ("huella_nueva", "tipo_nuevo")]
        for ev in eventos:
            ev["archivo"] = c.nombre
            all_eventos.append(ev)

        sha = _sha256_file(path) if path.exists() else None
        arch = {
            "nombre": c.nombre,
            "path": str(path),
            "bytes": path.stat().st_size if path.exists() else None,
            "sha256": sha,
            "tipo_codigo": c.tipo,
            "programa_erp": c.programa_erp,
            "confianza": c.confianza,
            "huella": _norm_huella(c.huella),
            "columnas_detectadas": columnas,
            "eventos": eventos,
        }
        archivos.append(arch)

        # staging tipado
        if c.tipo == "cheques_vencer":
            from parsers import mes_desde_nombre_cheques

            ym = mes_desde_nombre_cheques(c.nombre)
            for f in filas:
                staging["sf_cheque_vencer"].append(
                    {
                        "mes_ym": ym,
                        "banco_cod": f.get("Banco_Cod"),
                        "nro_cheque": f.get("Nro_Cheque"),
                        "cod_cliente": f.get("Cod_Cliente"),
                        "fecha_vto": f.get("Fecha_Vto"),
                        "importe": f.get("Importe"),
                        "moneda": f.get("Moneda"),
                        "archivo": c.nombre,
                    }
                )
        elif c.tipo in ("saldos_resumen", "saldos"):
            for f in filas:
                staging["sf_saldo_cliente"].append(
                    {
                        "cod_cliente": f.get("Cod_Cliente"),
                        "nombre": f.get("Nombre"),
                        "moneda": f.get("Moneda"),
                        "saldo": f.get("Saldo"),
                        "archivo": c.nombre,
                    }
                )
        elif c.tipo == "saldos_detallado":
            for f in filas:
                staging["sf_saldo_factura"].append(
                    {
                        "nro_factura": f.get("Nro_Factura"),
                        "cod_cliente": f.get("Cod_Cliente"),
                        "nombre": f.get("Nombre"),
                        "saldo": f.get("Saldo"),
                        "dias_vencido": f.get("Dias_Vencido"),
                        "archivo": c.nombre,
                    }
                )
        elif c.tipo == "pv_prog":
            for f in filas:
                staging["sf_pv_prog"].append({**f, "archivo": c.nombre})
        elif c.tipo.startswith("ventas"):
            staging["sf_venta_erp"].append(
                {
                    "subtipo": c.tipo,
                    "archivo": c.nombre,
                    "extra": {"totales": data.get("totales"), "preview": data.get("preview")},
                }
            )

    # manuales + sit fin líneas resumen
    for b in manuales.get("bancos") or []:
        staging["sf_manual_linea"].append(
            {
                "concepto": b.get("label"),
                "importe_gs": b.get("gs"),
                "importe_usd": b.get("usd"),
                "mes_ym": None,
            }
        )
    for ym, v in cheques_por_mes.items():
        if str(ym).startswith("_"):
            continue
        staging["sf_sit_fin_linea"].append(
            {"mes_ym": ym, "concepto": "CHEQUES A VENCER", "importe_gs": v, "origen": "auto"}
        )
    for k, v in aging.items():
        staging["sf_sit_fin_linea"].append(
            {"mes_ym": None, "concepto": f"AGING_{k}", "importe_gs": v, "origen": "auto"}
        )
    for ym, v in pv_prog_por_mes.items():
        staging["sf_sit_fin_linea"].append(
            {"mes_ym": ym, "concepto": "PV Y PROG A COBRAR", "importe_gs": v, "origen": "auto"}
        )

    estado = "variaciones_pendientes" if all_eventos else "cerrado"
    corte = {
        "batch_id": batch_id,
        "fecha_al": fecha_al.isoformat(),
        "tasa_usd": tasa_usd,
        "carpeta": carpeta,
        "estado": estado,
        "archivos": archivos,
        "variaciones": all_eventos,
        "n_variaciones": len(all_eventos),
        "staging_counts": {k: len(v) for k, v in staging.items()},
        "staging": staging,
        "created_at": _now_iso(),
    }
    catalogo.append_evento_log(batch_id, all_eventos)
    catalogo.save_catalogo()
    catalogo.guardar_corte(corte)
    # staging files
    stg_dir = catalogo.root / "staging" / batch_id
    stg_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in staging.items():
        (stg_dir / f"{name}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
        )
    return corte


def persistir_supabase(corte: dict) -> dict[str, Any]:
    """Inserta corte + archivos + variaciones + staging en Postgres. LAB."""
    url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not url:
        return {"ok": False, "error": "sin DATABASE_URL / SUPABASE_DB_URL"}
    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        return {"ok": False, "error": "psycopg2 no instalado"}

    conn = psycopg2.connect(url)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO sf_corte (batch_id, fecha_al, tasa_usd, carpeta, estado, meta)
            VALUES (%s::uuid, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                corte["batch_id"],
                corte["fecha_al"],
                corte.get("tasa_usd"),
                corte.get("carpeta"),
                corte.get("estado"),
                Json({"n_variaciones": corte.get("n_variaciones", 0)}),
            ),
        )
        corte_id = cur.fetchone()[0]
        arch_ids = {}
        for a in corte.get("archivos") or []:
            tipo = a.get("tipo_codigo")
            # tipo debe existir; desconocido está seed
            cur.execute(
                """
                INSERT INTO sf_archivo
                  (corte_id, nombre, path_relativo, bytes, sha256, tipo_codigo,
                   programa_erp, confianza, huella, columnas_detectadas)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    corte_id,
                    a["nombre"],
                    a.get("path"),
                    a.get("bytes"),
                    a.get("sha256"),
                    tipo if tipo else "desconocido",
                    a.get("programa_erp"),
                    a.get("confianza"),
                    a.get("huella"),
                    Json(a.get("columnas_detectadas") or []),
                ),
            )
            arch_ids[a["nombre"]] = cur.fetchone()[0]
            for ev in a.get("eventos") or []:
                cur.execute(
                    """
                    INSERT INTO sf_variacion_evento
                      (corte_id, archivo_id, clase, severidad, detalle, decision)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        corte_id,
                        arch_ids[a["nombre"]],
                        ev["clase"],
                        ev.get("severidad", "media"),
                        Json(ev.get("detalle") or {}),
                        ev.get("decision") or "pendiente",
                    ),
                )

        stg = corte.get("staging") or {}
        for row in stg.get("sf_cheque_vencer") or []:
            cur.execute(
                """
                INSERT INTO sf_cheque_vencer
                  (corte_id, archivo_id, mes_ym, banco_cod, nro_cheque, cod_cliente,
                   fecha_vto, importe, moneda)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    corte_id,
                    arch_ids.get(row.get("archivo")),
                    row.get("mes_ym"),
                    row.get("banco_cod"),
                    row.get("nro_cheque"),
                    row.get("cod_cliente"),
                    row.get("fecha_vto"),
                    row.get("importe") or 0,
                    row.get("moneda"),
                ),
            )
        for row in stg.get("sf_saldo_cliente") or []:
            cur.execute(
                """
                INSERT INTO sf_saldo_cliente
                  (corte_id, archivo_id, cod_cliente, nombre, moneda, saldo)
                VALUES (%s,%s,%s,%s,%s,%s)
                """,
                (
                    corte_id,
                    arch_ids.get(row.get("archivo")),
                    row.get("cod_cliente"),
                    row.get("nombre"),
                    row.get("moneda"),
                    row.get("saldo") or 0,
                ),
            )
        for row in stg.get("sf_saldo_factura") or []:
            cur.execute(
                """
                INSERT INTO sf_saldo_factura
                  (corte_id, archivo_id, nro_factura, cod_cliente, nombre, saldo, dias_vencido)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    corte_id,
                    arch_ids.get(row.get("archivo")),
                    row.get("nro_factura"),
                    row.get("cod_cliente"),
                    row.get("nombre"),
                    row.get("saldo") or 0,
                    row.get("dias_vencido"),
                ),
            )
        for row in stg.get("sf_pv_prog") or []:
            cur.execute(
                """
                INSERT INTO sf_pv_prog
                  (corte_id, archivo_id, nro_ped_prov, proforma, cod_cliente, nro_ped_cliente,
                   cod_operacion, fecha_pedido, fecha_entrega, importe_pedido, cant_cuotas,
                   importe_cuota, vencimientos)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    corte_id,
                    arch_ids.get(row.get("archivo") or row.get("Fuente")),
                    row.get("Nro_Ped_Prov"),
                    row.get("Proforma"),
                    row.get("Cod_Cliente"),
                    row.get("Nro_Ped_Cliente"),
                    row.get("Cod_Operacion"),
                    row.get("Fecha_Pedido"),
                    row.get("Fecha_Entrega"),
                    row.get("Importe_Pedido"),
                    row.get("Cant_Cuotas"),
                    row.get("Importe_Cuota"),
                    row.get("Vencimientos"),
                ),
            )
        for row in stg.get("sf_sit_fin_linea") or []:
            cur.execute(
                """
                INSERT INTO sf_sit_fin_linea
                  (corte_id, mes_ym, concepto, importe_gs, origen)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (
                    corte_id,
                    row.get("mes_ym"),
                    row.get("concepto"),
                    row.get("importe_gs") or 0,
                    row.get("origen") or "auto",
                ),
            )
        for row in stg.get("sf_manual_linea") or []:
            cur.execute(
                """
                INSERT INTO sf_manual_linea
                  (corte_id, mes_ym, concepto, importe_gs, importe_usd)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (
                    corte_id,
                    row.get("mes_ym"),
                    row.get("concepto"),
                    row.get("importe_gs"),
                    row.get("importe_usd"),
                ),
            )
        conn.commit()
        return {"ok": True, "corte_id": corte_id, "batch_id": corte["batch_id"]}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()
