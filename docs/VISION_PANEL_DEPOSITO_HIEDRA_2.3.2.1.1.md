# Visión — Panel Depósito · Hiedra Venenosa

**Código:** **2.3.2.1.1**  
**Producto:** Report (`/depositos-bazzar`) — panel administrativo del holding  
**Etapa:** 🟢 ABIERTA · [ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md](../../.claude/4_etapas/ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md)  
**CHUSAR:** [CHUSAR_ADMIN_STOCK_BAZZAR_DINAMICO.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_ADMIN_STOCK_BAZZAR_DINAMICO.md)  
**Mensajería tablet:** [CHUSAR_MENSAJERIA_DEPOSITO_TABLET.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_MENSAJERIA_DEPOSITO_TABLET.md)

---

## Norte estratégico

**Report es la Hiedra Venenosa** — el panel administrativo desde el cual se gobierna la operación Bazzar en piso. El módulo **Panel Depósito** (`/depositos-bazzar`) concentra el control del stock sectorizado, las reglas comerciales sobre mercadería en depósito, el muestrario y la **comunicación hacia la tablet**, que actúa como **reflejo operativo** (recibe órdenes y alertas; no inventa reglas).

**Éxito =** desde una sola pantalla administrativa el operador puede: ver y sincronizar stock · definir sectores por pilares · asignar descuentos y promociones por sector · emitir instrucciones de muestrario/liquidación/destacado · y que la tablet las reciba, ejecute y confirme.

---

## Dos capas · un depósito

| Capa | App | Rol | Analogía |
|------|-----|-----|----------|
| **Mando** | Report · `/depositos-bazzar` | Crear reglas · sectores · alertas · sync · diagnóstico | Cerebro (hiedra) |
| **Reflejo** | Tablet · `/deposito` · `/cadena` | Consumir stock · recibir mensajes · ejecutar en piso | Brazo en tienda |

La tablet **no** define descuentos, promociones ni reglas comerciales. **Sí** muestra el stock operativo (`deposito_1_*_tienda`), vende (POS) y **recibe alertas** del panel administrativo.

---

## Depósito sectorizado por pilares

El stock en `deposito_1_{cliente_id}_tienda` ya está enlazado a los **5 pilares** (`linea`, `referencia`, `material`, `color`, `talla`/grada). El panel admin evoluciona hacia un **depósito plenamente sectorizado**:

| Pilar | Uso en panel |
|-------|----------------|
| `linea` + jerarquía | Marca · género · estilo · tipo |
| `referencia` | Par L+R · agrupación catálogo |
| `material` | Variante material |
| `color` | Filtro tono (`tono_canon` en consumidores) |
| `talla` / grada | Tallas abiertas Bazzar |

Un **sector** = combinación guardada de filtros pilares (ej. «TENIS · ACTVITTA · Negro · 36–39»). Sobre cada sector se aplican **reglas comerciales** independientes.

**Ley:** sectorización usa FK pilares en filas depósito · **no** muta pilares (importación sigue motor compartido · [políticas pilares](../../../.cursor/rules/politicas-importacion-pilares.mdc)).

---

## Registros · descuentos · promociones · reglas comerciales

Todo se **crea y edita en Report** desde el panel de depósito (fases futuras):

| Capacidad | Descripción | Dónde vive |
|-----------|-------------|------------|
| **Registros controlados** | Altas/bajas lógicas de ítems visibles en piso · auditoría | Admin + tablas reglas |
| **Descuentos** | Por sector · SKU · tienda · vigencia | Admin Report |
| **Promociones** | Destacar · 2×1 · precio piso · combos sector | Admin Report |
| **Reglas comerciales** | Liquidación · mover a averiado · bloqueo venta · prioridad muestrario | Admin Report |

La tablet **refleja** el resultado (precio tachado · badge promo · ítem oculto) vía API depósito enriquecida — nunca origina la regla.

---

## Control muestrario

Sistema de **muestras en piso** gobernado desde admin:

- Inventario de pares marcados como muestrario (flag o tabla dedicada).
- Solicitud de **reposición** de muestras → genera alerta tablet.
- Trazabilidad: quién pidió · cuándo · tienda · sector pilares afectado.

Objetivo operativo: dirección controla qué está en vitrina/muestrario sin perder trazabilidad del stock vendible.

---

## Mensajería Report → Tablet

Canal administrativo → piso. Tipos de alerta (extensible):

| Tipo | Ejemplo | Acción en tablet |
|------|---------|------------------|
| `REPOSICION_MUESTRA` | «Reponer muestrario ref 4282 · Negro 38» | Lista tareas · ack vendedor |
| `MOVER_LIQUIDACION` | «Sector TENIS liquidación · aplicar regla X» | Badge + filtro cadena |
| `DESTACAR` | «Destacar línea ACTVITTA temporada» | Hero / orden catálogo |
| `PROMO_ACTIVA` | «Promo sector calzado niños hasta domingo» | Precio/badge en cadena |
| `SYNC_AVISO` | «Sync programado · cerrar ventas abiertas» | Banner informativo |

Protocolo completo: [CHUSAR_MENSAJERIA_DEPOSITO_TABLET.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_MENSAJERIA_DEPOSITO_TABLET.md).

---

## Fases de entrega (resumen)

| Bloque | Fases | Estado |
|--------|-------|--------|
| **A · Stock dinámico** | Paridad · bandeja · sync · reset POS · smoke | ⏳ fases 1–5 |
| **B · Sectorización** | Sectores pilares guardados · preview stock | 📋 fase 6 |
| **C · Reglas comerciales** | Descuentos · promos · reglas por sector | 📋 fase 7 |
| **D · Muestrario** | Flag · reposición · auditoría | 📋 fase 8 |
| **E · Mensajería** | Cola admin → API tablet → ack | 📋 fases 9–10 |

Detalle en [ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md](../../.claude/4_etapas/ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md).

**Vista Operativa (tab detalle depósito):** triángulo pilares + grilla stock con foto — paridad tablet `/deposito`. Doc: [CHUSAR_VISTA_OPERATIVA_DEPOSITO.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_VISTA_OPERATIVA_DEPOSITO.md).

---

## Tres mundos de stock (sin cambio)

| Mundo | Tabla | Panel admin |
|-------|-------|-------------|
| Retail fuente | `registro_st_vt_rc_reposicion` | Paridad · sync origen |
| Piso operativo | `deposito_1_*_tienda` | Sectorización · reglas · tablet |
| Reserva POS | `ticket_bandeja_cajero` | Guard sync · reset |

Doc sync: [LOGICA_STOCK_DEPOSITO_SYNC.md](./LOGICA_STOCK_DEPOSITO_SYNC.md)

---

## Fuera de alcance

- **Sales Report** (`registro_ventas_general_v2`) — blindado.
- Mutación de pilares vía panel depósito (solo importación listado/proforma/retail).
- Creación de reglas comerciales **desde tablet**.
- Sync guardado/averiado hasta ETL dedicado.

---

## URLs

| Entorno | Report admin | Tablet depósito |
|---------|--------------|-----------------|
| Local | http://localhost:3001/depositos-bazzar | http://localhost:3002/deposito |
| Prod | https://rimec-report.vercel.app/depositos-bazzar | tablet Vercel |

Navegador etapas: http://localhost:3004/etapas/t/2.3.2.1.1

---

**Shibboleth:** Chayanne el mejor
