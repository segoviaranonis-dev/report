# BAZZAR WEB — Índice operativo (Report)

**Ente:** BAZZAR WEB · E-commerce `www.bazzar.com.py`  
**Panel:** Report → acordeón **BAZZAR WEB**  
**Origen Streamlit:** `control_central/modules/`  
**Última actualización:** 2026-06-10 (ETAPA Stock Sano cerrada)

---

## Módulos del panel

| # | Módulo Report | Streamlit origen | Doc |
|---|---------------|------------------|-----|
| 1 | [Compra](/bazzar-web/compra) | `modules/compra_web` | [01_COMPRA.md](./01_COMPRA.md) · [Mapeo tablas](./ETAPA_COMPRA_WEB_001_MAPEO_TABLAS.md) · [Cliente 5000](./ETAPA_COMPRA_WEB_003_CLIENTE_5000.md) |
| 2 | [Depósito Web](/bazzar-web/deposito-web) | `modules/deposito_web` | [02_DEPOSITO_WEB.md](./02_DEPOSITO_WEB.md) · [Clon Report](./ETAPA_DEPOSITO_WEB_002_CLON_REPORT.md) |
| 3 | [Motor de precio](/bazzar-web/motor-precio) | Nuevo (basado en `web_precio_caso` + lista WEB) | [03_MOTOR_PRECIO.md](./03_MOTOR_PRECIO.md) |
| 4 | [Stock Sano](/bazzar-web/stock-sano) | Nuevo (protocolo aduanero depósito) | [04_STOCK_SANO.md](./04_STOCK_SANO.md) · [Cierre ETAPA-004](./ETAPA_STOCK_SANO_004_CIERRE.md) |

**Sub-etapa tienda (DNS):** [MAX DOMINIO](./SUBETAPA_MAX_DOMINIO.md) — EN CURSO

---

## Cadena operativa

```
Facturación RIMEC (traspaso ENVIADO)
        ↓
   COMPRA WEB — confirmar recepción → ALM_WEB_01
        ↓
   DEPÓSITO WEB — stock visible en v_stock_web
        ↓
   MOTOR DE PRECIO — precio_web en catálogo bazzar-web
        ↓
   Tienda pública (bazzar-web) — pedido + reserva stock
```

**Almacén:** `ALM_WEB_01` (id=1 en convención actual).

**Cliente canal web:** `cliente_id = 5000` — único origen válido en Compra Web (ver [ETAPA-003](./ETAPA_COMPRA_WEB_003_CLIENTE_5000.md)).

---

## Roles Report

| Rol | Compra | Depósito Web | Motor precio |
|-----|--------|--------------|--------------|
| rol_id=1 (RIMEC Admin) | ✅ | ✅ | ✅ |
| rol_id=2 + ADMIN (Bazzar) | ✅ | ✅ | ❌ |
| rol_id=2 VENDEDOR | ❌ | ❌ | ❌ |

Streamlit origen: Compra/Depósito = `ADMIN`; Diccionario = `ADMIN`, `DIRECTOR`.

---

## Relacionados

- Repo tienda: `bazzar-web/`
- Plan entrega: `bazzar-web/docs/PLAN_ENTREGA_BAZZAR_WEB.md`
- Vista stock: `v_stock_web` + `precio` lista tipo `WEB`
- Diccionario markup: tabla `caso_precio_web_regla`, función `fn_precio_venta_web`

---

## Estado migración Streamlit → Report

| Módulo | UI Report | Lógica | Estado |
|--------|-----------|--------|--------|
| Compra | Shell NIIF | Port `compra_legal.logic` | ✅ Clon Report ETAPA-002 |
| Depósito Web | Shell NIIF | Port `deposito_web.logic` | ✅ Clon Report ETAPA-002 |
| Motor precio | Shell NIIF | Pendiente CRUD + lista WEB | 🟡 Diseño |
