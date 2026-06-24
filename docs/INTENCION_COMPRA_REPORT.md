# Intención de compra — Report (2.3.1.7.3)

**Subproceso de:** [PROCESO_IMPORTACION_REPORT.md](./PROCESO_IMPORTACION_REPORT.md) · **Ruta:** `/proceso-importacion/intencion-compra`  
**Moria CHUSAR:** [.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_INTENCION_COMPRA.md](../../.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_INTENCION_COMPRA.md)  
**Inventario:** [INTENCION_COMPRA.md](../../.claude/2_modulos/2.3_report/proceso_importacion/INTENCION_COMPRA.md)  
**Bandeja (mapa UI):** [IC_BANDEJA.md](../../.claude/2_modulos/2.3_report/proceso_importacion/IC_BANDEJA.md)  
**FECHA DE EMBARQUE:** [FECHA_DE_EMBARQUE.md](../../.claude/2_modulos/2.3_report/proceso_importacion/FECHA_DE_EMBARQUE.md)  
**Estado:** ▶ En curso (maratón 7.3)

---

## Por qué Report

Cabecera financiera de la importación — sin SKUs ni proforma. Paridad Streamlit `intencion_compra` con UI NIIF, sesión y roles Report.

**PROHIBIDO en IC:** material, color, línea, referencia, gradas, moléculas PPD.

---

## URLs dev

| Recurso | URL |
|---------|-----|
| Hub IC | http://localhost:3001/proceso-importacion/intencion-compra |
| Bandeja | http://localhost:3001/proceso-importacion/intencion-compra/bandeja |
| Nueva IC | http://localhost:3001/proceso-importacion/intencion-compra/nueva |

Report en **`:3001`** si Tablet ocupa `:3000`. Reinicio: `npm run dev:clean:3001`.

---

## Rutas (`src/lib/report/routes.ts`)

```typescript
INTENCION_COMPRA           // hub → bandeja
INTENCION_COMPRA_BANDEJA   // tabs PENDIENTES / DEVUELTAS / HISTORIAL
INTENCION_COMPRA_NUEVA     // Paso A + formulario
```

---

## Flujo operativo

```txt
Paso A (tipo + categoría) → Formulario IC → PENDIENTE_OPERATIVO
  → Autorizar → AUTORIZADO → Digitación asigna PP → DIGITADO
```

Formato registro: **`IC-YYYY-XXXX`**

---

## Páginas Report

| Código | Ruta | Componente |
|--------|------|------------|
| 2.3.1.7.3 | `…/intencion-compra` | redirect / hub |
| 2.3.1.7.3.1 | `…/bandeja` | `IntencionCompraBandejaClient` |
| 2.3.1.7.3.2 | `…/nueva` | `IntencionCompraNuevaClient` |

Carpeta: `src/app/proceso-importacion/intencion-compra/`  
Lib: `src/lib/intencion-compra/*`

---

## APIs (`/api/proceso-importacion/intencion-compra/*`)

| Método | Ruta | Función |
|--------|------|---------|
| GET | `/catalogos` | Proveedores, marcas por tipo, plazos, quincenas, eventos |
| GET | `/pendientes` | Panel pendientes operativos |
| GET | `/bandeja` | Historial completo |
| GET | `/devueltas` | IC devueltas admin |
| POST | `/` | Alta IC |
| PATCH | `/[id]/campo` | Edición inline bandeja |
| POST | `/[id]/autorizar` | → AUTORIZADO |
| POST | `/[id]/reautorizar` | Desde DEVUELTAS |
| POST | `/[id]/anular` | Anulación |
| GET | `/marcas?tipo_id=` | Marcas filtradas `marca_tipo_v2` |

Auth: `requireMotorPreciosAdmin()`.

---

## FECHA DE EMBARQUE (dato duro)

- Columna: `intencion_compra.quincena_arribo_id` → catálogo `quincena_arribo` (1–24)
- Obligatoria para **AUTORIZAR**
- Label UI Report: **FECHA DE EMBARQUE** (Streamlit legacy: «Llegada»)

---

## Handoff

IC **AUTORIZADA** sin fila en `intencion_compra_pedido` → aparece en **Digitación → PENDIENTES**.

---

## Build · validación

```powershell
cd C:\Users\hecto\Nexus_Core\report
npm run build
```

No `npm run build` con `next dev` abierto.

---

**Shibboleth:** Chayanne el mejor
