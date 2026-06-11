# Aprobaciones — Report (Next.js)

**Palabra clave holding:** **Nivel Dios** — instancia de control superlativo sobre pedidos y facturas internas.

Gemelo funcional del módulo Streamlit `control_central/modules/aprobacion_pedidos`.  
Misma fuente de datos (`factura_interna`, `pv_global`, `pedido_venta_rimec`, 4 pestañas FI-centric).

---

## Nivel Dios — potestad y acceso

| Ámbito | Regla |
|--------|--------|
| **Entrar a Report (login)** | Usuario válido en `usuario_v2` con su `rol_id` (1, 2 o 3) |
| **rol_id = 1** | Todos los módulos Report (RIMEC, retail, ventas-fotos, informes, etc.) |
| **rol_id = 2** | Bazzar: retail / depósitos / tablet (según `categoria`) |
| **rol_id = 3** | Solo ventas-fotos |
| **Solo `/aprobaciones`** | **Adicional:** `rol_id = 1` **y** `categoria = 'DIOS'` |

**Palabra clave holding:** **Nivel Dios** = instancia de control superlativo **solo en el módulo Aprobaciones**.

### Alta de usuario Nivel Dios (SQL)

```sql
UPDATE usuario_v2
SET rol_id = 1, categoria = 'DIOS'
WHERE descp_usuario = 'TU_USUARIO';
```

Tras el cambio: **cerrar sesión y volver a login** para que la cookie traiga `categoria=DIOS`.

### Capas de enforcement (código)

| Capa | Archivo | Comportamiento |
|------|---------|----------------|
| Middleware | `src/middleware.ts` | `/aprobaciones` → solo `rol_id=1` + `role=DIOS` en JWT |
| SSR | `src/app/aprobaciones/page.tsx` | Sin Nivel Dios → pantalla “Nivel Dios requerido” (defensa en profundidad) |
| Mutaciones | `src/app/aprobaciones/actions.ts` | `requireNivelDiosAction()` antes de confirmar/anular/rechazar/cambiar lista |
| Helper | `src/lib/auth/nivel-dios.ts` | `isNivelDios()`, constantes `NIVEL_DIOS_ROL_ID`, `NIVEL_DIOS_CATEGORIA` |

**Nota:** `rol_id=1` con `categoria=ADMIN` (Director, Tito, etc.) **entra a Report con normalidad**; solo **no** ve ni accede a `/aprobaciones`. Para operar Aprobaciones: `categoria='DIOS'`.

---

## Contrato Nivel Dios (obligatorio para todo editor)

El operador de Aprobaciones **manda**; la BD **obedece en el mismo click**.

| Regla | Implementación |
|-------|----------------|
| **Persistencia inmediata** | Server Action → mutación SQL en **una transacción** (`BEGIN`…`COMMIT`). Prohibido “guardar después”. |
| **Fuente de precio lista** | `pedido_proveedor_detalle` vía `fid.ppd_id` → `precio_lpn` / `precio_lpc02` / `precio_lpc03` / `precio_lpc04`. |
| **Recálculo** | Cascada desc. 1–4 → `precio_neto`; `subtotal = neto × pares`; cabecera FI = `SUM(detalle)`. |
| **Sincronía PVR** | Tras editar FI: `syncPedidoTotalesDesdeFis` → `pedido_venta_rimec.total_*`; si 1 sola FI activa, también `lista_precio_id`. |
| **CONFIRMADA en tránsito** | Flip temporal `CONFIRMADA→RESERVADA→CONFIRMADA` durante UPDATE (paridad Streamlit). |
| **Cierre edición** | Solo si `pedido_proveedor.estado = ENVIADO` (compra legal enviada). |
| **Helpers reutilizables** | `lib/fi-editor-sync.ts` — vendedor, descuentos, cantidades futuras deben usar el mismo patrón. |

**Prohibido en editores Nivel Dios:** optimismo solo en React, parches en memoria, recalcular precio en cliente sin escribir BD, usar `v_stock_rimec` si existe columna snapshot en PPD.

---

## Propósito del módulo (ley de negocio)

**Aprobaciones no es solo Aprobar/Rechazar: es un editor administrativo de pedidos.**

| Actor | Rol |
|-------|-----|
| **Vendedor** (rimec-web) | Arma el carrito y envía lo que quiere comprar. |
| **Administración Nivel Dios** (este módulo) | Confirma, rechaza y **corrige** contenido antes y durante el tránsito. |

La **Factura Interna** (`factura_interna` + detalle) es el **reflejo en BD** de la decisión administrativa. Alimenta stock reservado en **Pedido Proveedor** (`pedido_proveedor_detalle`) y debe coincidir con operación posterior.

### Mercadería en tránsito = sigue editable

Aunque una FI pase a **CONFIRMADA** y tenga `PV000147`, la mercadería sigue en **tránsito** (stock PP, compra legal no cerrada). Administración puede:

- Ajustar **cantidades** (cajas / pares por grada) — *próximo editor*.
- Corregir **encabezado** (LPN/LPC, caso, plazo, descuentos 1–4).
- Cambiar **cliente** / **vendedor** — *próximo editor*.
- **Anular** líneas o la FI completa (devuelve saldo al PP).

### Frontera dura — cuándo se cierra la edición

| Fase del PP | `pedido_proveedor.estado` | Edición Nivel Dios |
|-------------|---------------------------|---------------------|
| Operación / preventa / tránsito | `ABIERTO`, `CERRADO`, etc. | **Permitida** (RESERVADA y CONFIRMADA) |
| Compra legal enviada | **`ENVIADO`** | **Cerrada** — solo lectura |

Referencia holding: listado bloqueado en PP `ENVIADO` (`pp_listado_precio_editable = false`).

### Flujo resumido

```
Vendedor (web) → FIs RESERVADA
  → Nivel Dios edita / confirma / anula (Aprobaciones Report)
  → FI CONFIRMADA + pv_global
  → [Sigue editable mientras PP en tránsito]
  → PP ENVIADO → edición cerrada
```

Doc Streamlit ampliada: `.claude/2_modulos/2.1_control_central/modules/aprobacion_pedidos/CONTEXT.md`.

---

## Ejecución local — «NO SE EJECUTA»

Síntoma habitual: navegador en blanco, 500 en `/aprobaciones`, o `Cannot find module './NNNN.js'`.

**Causa:** caché `.next` corrupta — casi siempre por correr **`npm run build` con `npm run dev` abierto**.

### Fix (Windows)

Doble clic en:

```
report/REINICIAR_DEV.bat
```

O manual:

```powershell
cd C:\Users\hecto\Nexus_Core\report
# Matar procesos en :3000 y :3001, borrar .next, levantar dev
.\REINICIAR_DEV.bat
```

| Recurso | URL |
|---------|-----|
| **Módulo (login + Nivel Dios)** | **http://localhost:3000/aprobaciones** |
| Login | http://localhost:3000/login |

Si `:3000` está ocupado, Next usa **3001** → `http://localhost:3001/aprobaciones`.

### Reglas de operación dev

1. **No** `npm run build` mientras `npm run dev` corre.
2. Si cambiaste auth (`DIOS`): logout + login.
3. `.env.local` requerido: `DATABASE_URL`, `REPORT_SESSION_SECRET` (Supabase público para fotos bucket `productos`).

### Validación tras cambios de código

```powershell
# Primero cerrar dev (Ctrl+C), luego:
npm run build
# Volver a REINICIAR_DEV.bat para probar en navegador
```

---

## UI de tarjeta FI (`FiCard`)

### Cabecera (siempre visible)

1. **Cliente** — nombre + código.
2. **Documentos** (derecha) — `PV000147`, PP/proforma, FI legacy.
3. **Tres filas comerciales:**
   - **Fila 1:** Lista precio (editor Nivel Dios) · Caso · Plazo
   - **Fila 2:** Desc. 1–4 (`0%` si vacío)
   - **Fila 3:** Usuario vendedor · Fecha llegada · badge estado

### Acordeón «Productos» (cerrado)

- Resumen: `N ítems · X pares`.
- Al expandir: foto, grada, LPN neto, cajas/pares/subtotal.
- Imágenes lazy (solo al abrir acordeón).

### Acordeón «Más datos de la factura»

- Marca, pares, monto, notas.
- Confirmar / Anular (FIs `RESERVADA`).

---

## Pestañas (gemelo Streamlit)

| Tab | Datos |
|-----|--------|
| Pendientes | Pedidos PVR con FIs `RESERVADA` embebidas |
| Reservadas | FIs `RESERVADA` |
| Confirmadas | FIs `CONFIRMADA` (`pv_global DESC`) |
| Anuladas | FIs `ANULADA` |

---

## Editor lista de precios (v1 — LPN/LPC)

En FI **CONFIRMADA** o **RESERVADA** (PP no `ENVIADO`), celda **Lista precio** con botón ▾:

- Opciones: LPN · LPC02 · LPC03 · LPC04
- Precio desde `pedido_proveedor_detalle` (`ppd_id`)
- Recalcula neto/subtotal/total; sync PVR vía `fi-editor-sync.ts`
- Action: `cambiarListaPrecioFiAction()` → `actualizarListaPrecioFi()`

**Próximos editores Nivel Dios:** selector vendedor (`usuario_v2`), descuentos inline, cantidades por grada.

---

## Gradas e imágenes

- Parser: `src/app/aprobaciones/lib/linea-snapshot-display.ts`
- Prioridad grada: `linea_snapshot.gradas_fmt` → snapshot → `ppd.grades_json`
- Formato importadora: `34(1 2 3 3 2 1)39`
- Fotos: `NEXUS_PROTOCOLO_IMAGENES_PRODUCTO.md`, bucket `productos`, `L-R-M-C.jpg`

---

## Mapa de código

```
src/lib/auth/nivel-dios.ts          # isNivelDios, constantes DIOS
src/app/aprobaciones/
  page.tsx                          # SSR + gate Nivel Dios
  AprobacionesClient.tsx            # 4 tabs
  actions.ts                        # server actions + requireNivelDios
  lib/require-nivel-dios.ts
  lib/aprobaciones-queries.ts
  lib/aprobaciones-mutations.ts     # confirmar, anular, lista precio
  lib/fi-editor-sync.ts             # sync PVR tras mutación FI
  lib/aprobaciones-utils.ts
  lib/aprobaciones-types.ts
  lib/linea-snapshot-display.ts
  components/FiCard.tsx
  components/ListaPrecioEditor.tsx
  components/ItemRow.tsx
  components/PedidoPendienteCard.tsx
src/middleware.ts                   # /aprobaciones → rol 1 + DIOS
REINICIAR_DEV.bat                   # fix «no se ejecuta»
```

Referencia Streamlit: `control_central/modules/aprobacion_pedidos/logic.py`, `core/fi_card.py`.

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-06-10 | Doc Nivel Dios completa; gate `rol_id=1` + `categoria=DIOS`; troubleshooting dev. |
| 2026-06-11 | Contrato persistencia inmediata; `fi-editor-sync.ts`; editor LPN/LPC. |
| 2026-06-10 | Layout 3 filas; productos en acordeón. |
