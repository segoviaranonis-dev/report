# OT-REPORT-SALES-PDF-PARIDAD-STREAMLIT-008 — Mapa de Paridad PDF

**Fecha:** 2026-05-31  
**Estado:** MAPEO COMPLETADO — NO IMPLEMENTADO  
**Decisión:** Documentar equivalencias Streamlit ↔ Next.js sin portar código aún

---

## **OBJETIVO**

Replicar en Report Next.js la lógica de generación PDF que ya existe y funciona en Sales Report Streamlit.

**NO inventar lógica nueva. COPIAR/ADAPTAR lógica de Streamlit.**

---

## **STREAMLIT (control_central/modules/sales_report)**

### **Funciones PDF principales**

#### **1. ExportManager.generate_general_report()**
**Ubicación:** `export.py` línea 35

```python
def generate_general_report(title, pkg_item, group_cols=None, meta_info=None,
                            show_total=True, mode="gerencial"):
    """
    Orquestador principal de PDF.
    mode="gerencial" → reporte ejecutivo con jerarquía y subtotales.
    mode="listado"   → listado informativo, fila completa sin ocultar repetidos.
    """
    from core.report_engine import ReportEngine
    
    df_to_print = pkg_item['data'] if isinstance(pkg_item, dict) and 'data' in pkg_item else pkg_item
    
    return ReportEngine.generate_pdf(
        title,
        df_to_print,
        group_cols=group_cols,
        meta_info=meta_info,
        show_total=show_total,
        mode=mode,
    )
```

**Características:**
- Entrada: título, DataFrame (o paquete con 'data'), columnas de agrupación, metadata filtros
- Salida: BytesIO con PDF
- Modos: `"gerencial"` (jerarquía + subtotales automáticos) | `"listado"` (tabla plana)
- Motor real: `core.report_engine.ReportEngine.generate_pdf()`

---

#### **2. export_batch_zip()**
**Ubicación:** `ui.py` línea 47

```python
def export_batch_zip(pkg_item, group_col, filename_prefix, group_cols_pdf, report_title):
    t_init = time.time()
    df = pkg_item['data'] if isinstance(pkg_item, dict) else pkg_item
    zip_buffer = BytesIO()
    items = df[group_col].unique()
    
    # Captura de metadata global para el lote
    metadata_nexus = FilterManager.get_report_metadata()
    
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for item in items:
            filtered_df = df[df[group_col] == item].copy()
            # Inyectamos la metadata capturada por los micrófonos
            pdf_io = ExportManager.generate_general_report(
                f"{report_title}: {item}",
                filtered_df,
                group_cols=group_cols_pdf,
                meta_info=metadata_nexus
            )
            zip_file.writestr(f"{str(item).replace('/', '_')}.pdf", pdf_io.getvalue())
    
    zip_buffer.seek(0)
    _ui_mic(f"Lote {filename_prefix} listo: {len(items)} archivos", t_start=t_init)
    return zip_buffer, len(items)
```

**Lógica:**
1. Obtiene valores únicos de `group_col` (ej: todas las marcas únicas en el DataFrame)
2. Por cada valor:
   - Filtra DataFrame donde `group_col == valor`
   - Genera PDF individual con `generate_general_report()`
   - Nombre: `{valor}.pdf` (sanitiza `/` → `_`)
   - Agrega al ZIP
3. Captura metadata de filtros activos una sola vez (global para todo el batch)
4. Retorna: BytesIO ZIP + count de archivos

---

#### **3. FilterManager.get_report_metadata()**
**Ubicación:** No especificada en grep, pero referenciada en `export_batch_zip`

**Función:** Captura estado actual de filtros activos (periodo, vendedor, cliente, etc.) para inyectar en metadata de PDF.

---

### **Tablas con PDF implementado**

| # | Tabla | Paquete | PDF Individual | Batch PDF | Batch por | group_cols |
|---|-------|---------|----------------|-----------|-----------|------------|
| 1 | Evolución mensual | `pkg['evolucion']` | ✓ | ✗ | - | - |
| 2 | Cartera: Crecimiento | `pkg['cartera']['crecimiento']` | ✓ (unificado) | ✗ | - | - |
| 3 | Cartera: Decrecimiento | `pkg['cartera']['decrecimiento']` | ✓ (unificado) | ✗ | - | - |
| 4 | Cartera: Sin compra | `pkg['cartera']['sin_compra']` | ✓ (unificado) | ✗ | - | - |
| 5 | Marcas: Ranking | `pkg['marcas'][0]` | ✓ | ✗ | - | - |
| 6 | **Marcas: Detalle** | **`pkg['marcas'][1]`** | **✓** | **✓** | **Marca** | `['Marca', 'Cadena', 'Cliente', 'Vendedor']` |
| 7 | Vendedores: Ranking | `pkg['vendedores'][0]` | ✓ | ✗ | - | - |
| 8 | **Vendedores: Gestión detallada** | **`pkg['vendedores'][1]`** | **✓** | **✓** | **Vendedor** | `['Vendedor', 'Cadena', 'Cliente', 'Marca', 'Mes']` |

**Totales:**
- 8 tablas con PDF individual
- 2 tablas con Batch PDF (Marcas detalle, Vendedores gestión detallada)

---

### **Botones UI en Streamlit**

#### **PDF Individual (todas las tablas)**
**Ubicación:** `ui.py` línea 86, 328

```python
if col_p.button(f"📄 PDF", key=f"btn_pdf_{key_suffix}", use_container_width=True):
    with st.spinner("Procesando..."):
        metadata = FilterManager.get_report_metadata()
        pdf = ExportManager.generate_general_report(
            title, pkg, group_cols=group_cols, meta_info=metadata
        )
    st.download_button("💾 BAJAR", pdf.getvalue(), f"{title}.pdf", 
                       "application/pdf", key=f"dl_{key_suffix}")
```

#### **Batch PDF (Marcas)**
**Ubicación:** `ui.py` línea 356

```python
if col2.button("📦 BATCH PDF", key="btn_batch_mar", use_container_width=True):
    with st.spinner("Generando PDFs por Marca..."):
        z_buf, ct = export_batch_zip(
            pkg_mar_det, 
            'Marca', 
            "Marcas", 
            ['Marca', 'Cadena', 'Cliente', 'Vendedor'], 
            "Matriz de Marca"
        )
        st.download_button(f"⬇️ DESCARGAR ZIP ({ct})", z_buf.getvalue(), 
                           "batch_marcas.zip", "application/zip", key="dl_batch_mar")
```

#### **Batch PDF (Vendedores)**
**Ubicación:** `ui.py` línea 373

```python
if col2.button("📦 BATCH PDF", key="btn_batch_ven", use_container_width=True):
    with st.spinner("Generando PDFs por Vendedor..."):
        z_buf, ct = export_batch_zip(
            pkg_ven_det, 
            'Vendedor', 
            "Vendedores", 
            ['Vendedor', 'Cadena', 'Cliente', 'Marca', 'Mes'], 
            "Gestión Detallada"
        )
        st.download_button(f"⬇️ DESCARGAR ZIP ({ct})", z_buf.getvalue(), 
                           "batch_vendedores.zip", "application/zip", key="dl_batch_ven")
```

---

### **Jerarquía de 5 niveles (Vendedores Gestión Detallada)**

**Referencia:** `GESTION_DETALLADA_MAPA_TABLA8.md`

**Orden fijo de agrupación:**
1. **Vendedor** (ej: CARINA)
2. **Cadena** (ej: SALEMMA RETAIL S.A.) — solo si existe y no es `_CADENA_NULA`
3. **Cliente**
4. **Marca**
5. **Mes** (nombre legible desde `mes_idx`)

**Separador:** `|||` (tres pipes)

**Ejemplo de `_path`:**
```
CARINA|||SALEMMA RETAIL S.A.|||SALEMMA RETAIL S.A.|||MOLEKINHA|||Junio
```

**Subtotales:**
- AgGrid: `treeData: true` + `groupIncludeFooter: true`
- Columnas numéricas: `aggFunc: 'sum'`
- **Variación %**: `aggFunc` personalizado que calcula `(ΣMonto26 - ΣMontoObj) / ΣMontoObj × 100` sobre hijos del grupo (NO promedio de %)
- Si `MontoObj == 0` y `MontoReal > 0`: muestra `∞` (sin base de comparación)

---

## **NEXT.JS ACTUAL (report/src)**

### **Estado: ❌ NO HAY NADA DE PDF IMPLEMENTADO EN RIMEC**

### **Archivos existentes**

#### **UI Components**
- `src/app/rimec/RimecClient.tsx` — cliente principal
- `src/app/rimec/ImmersiveClient.tsx` — vista inmersiva
- `src/app/rimec/components/MundoMarcas.tsx` — tab marcas
- `src/app/rimec/components/MundoVendedores.tsx` — tab vendedores
- `src/app/rimec/components/MundoClientes.tsx` — tab clientes
- `src/app/rimec/components/MundoDashboard.tsx` — dashboard
- `src/app/rimec/components/TablaJerarquica.tsx` — tabla genérica jerárquica
- `src/app/rimec/components/TablaJerarquiaMarcaVendedor.tsx`
- `src/app/rimec/components/TablaJerarquiaVendedorCadenaClienteMarcaMes.tsx` — 5 niveles

#### **Lógica**
- `src/lib/rimec/sales-logic.ts` — cálculos (equivalente a `logic.py`)
- `src/lib/rimec/snapshot-to-pkg.ts` — transformación datos
- `src/lib/rimec/full-snapshot-types.ts` — tipos TypeScript
- `src/lib/rimec/variacion-objetivo.ts` — cálculo variación %
- `src/lib/rimec/pivot-query.ts` — queries pivot
- `src/lib/rimec/cliente-jerarquia-query.ts` — jerarquías clientes

#### **API**
- `src/app/api/rimec/full-snapshot/route.ts` — obtener datos completos
- `src/app/api/rimec/analysis/route.ts` — análisis
- `src/app/api/rimec/meta/route.ts` — metadata

### **Qué falta**

| Item | Streamlit | Next.js | Estado |
|------|-----------|---------|--------|
| Generador PDF base | `ReportEngine.generate_pdf()` | ❌ | Falta crear `src/lib/rimec/pdfGenerator.ts` |
| Endpoint PDF individual | - | ❌ | Falta crear `src/app/api/rimec/pdf/route.ts` |
| Endpoint Batch ZIP | - | ❌ | Falta crear `src/app/api/rimec/batch-pdf/route.ts` |
| Botones PDF UI | `ui.py` línea 86, 328 | ❌ | Falta agregar en MundoMarcas, MundoVendedores |
| Botones Batch UI | `ui.py` línea 356, 373 | ❌ | Falta agregar en MundoMarcas, MundoVendedores |
| Metadata filtros activos | `FilterManager.get_report_metadata()` | ❌ | Falta crear función de captura |
| Formateo tablas jerárquicas PDF | `ReportEngine` modo "gerencial" | ❌ | Falta lógica subtotales en PDF |
| Generación ZIP | `zipfile` Python | ❌ | Falta usar `jszip` o `archiver` |

---

## **PLAN DE IMPLEMENTACIÓN (NO EJECUTADO AÚN)**

### **Fase 1: Generador PDF base**

**Crear:** `src/lib/rimec/pdfGenerator.ts`

```typescript
interface RimecPDFOptions {
  title: string;
  data: any[]; // DataFrame equivalente
  groupCols?: string[]; // Columnas de agrupación jerárquica
  metadata?: Record<string, any>; // Filtros activos
  showTotal?: boolean;
  mode?: "gerencial" | "listado";
}

export async function generateRimecPDF(options: RimecPDFOptions): Promise<Buffer>
```

**Responsabilidades:**
- Página ejecutiva: título, metadata filtros (periodo, vendedor, etc.)
- Tabla con datos:
  - **Modo "gerencial"**: jerarquía visual, subtotales por grupo
  - **Modo "listado"**: tabla plana, todas las filas visibles
- Subtotales:
  - Columnas numéricas: suma
  - Variación %: cálculo sobre totales agregados (no promedio)
- Footer institucional (NEXUS, Report, fecha)
- Usa: `pdf-lib` (ya disponible en proyecto)

---

### **Fase 2: Endpoint PDF individual**

**Crear:** `src/app/api/rimec/pdf/route.ts`

```typescript
// POST /api/rimec/pdf
interface RequestBody {
  title: string;
  data: any[];
  groupCols?: string[];
  metadata?: Record<string, any>;
  mode?: "gerencial" | "listado";
}

// Response: blob PDF (application/pdf)
```

**Lógica:**
1. Recibe payload con datos y opciones
2. Llama a `generateRimecPDF()`
3. Retorna PDF como blob

---

### **Fase 3: Endpoint Batch ZIP**

**Crear:** `src/app/api/rimec/batch-pdf/route.ts`

```typescript
// POST /api/rimec/batch-pdf
interface RequestBody {
  data: any[];
  groupCol: string; // Columna para dividir (ej: "Marca")
  groupColsPdf: string[]; // Columnas para jerarquía en cada PDF
  reportTitle: string;
  metadata?: Record<string, any>;
}

// Response: blob ZIP (application/zip)
```

**Lógica:**
1. Obtiene valores únicos de `groupCol`
2. Por cada valor:
   - Filtra `data` donde `groupCol == valor`
   - Genera PDF con `generateRimecPDF()`
   - Agrega al ZIP con nombre `{valor}.pdf`
3. Usa: `jszip` o `archiver` para generar ZIP
4. Retorna ZIP como blob

**Instalación requerida:**
```bash
npm install jszip
npm install -D @types/jszip
```

---

### **Fase 4: Botones UI**

#### **MundoMarcas.tsx**

```tsx
// Agregar después de tabla detalle
<div className="flex gap-2 mt-4">
  <button 
    onClick={handleGenerarPDFMarcas}
    disabled={!marcasDetalle.length}
    className="btn-primary"
  >
    📄 PDF
  </button>
  <button 
    onClick={handleBatchPDFMarcas}
    disabled={!marcasDetalle.length}
    className="btn-secondary"
  >
    📦 BATCH PDF
  </button>
</div>
```

**Handlers:**
```typescript
async function handleGenerarPDFMarcas() {
  const res = await fetch('/api/rimec/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Matriz de Marca',
      data: marcasDetalle,
      groupCols: ['Marca', 'Cadena', 'Cliente', 'Vendedor'],
      metadata: captureActiveFilters(),
      mode: 'gerencial',
    }),
  });
  const blob = await res.blob();
  downloadBlob(blob, 'matriz_marca.pdf');
}

async function handleBatchPDFMarcas() {
  const res = await fetch('/api/rimec/batch-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: marcasDetalle,
      groupCol: 'Marca',
      groupColsPdf: ['Marca', 'Cadena', 'Cliente', 'Vendedor'],
      reportTitle: 'Matriz de Marca',
      metadata: captureActiveFilters(),
    }),
  });
  const blob = await res.blob();
  downloadBlob(blob, 'batch_marcas.zip');
}
```

#### **MundoVendedores.tsx**

Similar a MundoMarcas, pero con:
- `groupCol: 'Vendedor'`
- `groupColsPdf: ['Vendedor', 'Cadena', 'Cliente', 'Marca', 'Mes']` (5 niveles)
- Nombres: `gestion_detallada.pdf`, `batch_vendedores.zip`

---

### **Fase 5: Metadata de filtros activos**

**Crear:** `src/lib/rimec/captureFilters.ts`

```typescript
export function captureActiveFilters(filters: RimecFilters): Record<string, any> {
  return {
    periodo: `${filters.periodo.desde} - ${filters.periodo.hasta}`,
    vendedor: filters.vendedor || 'Todos',
    cliente: filters.cliente || 'Todos',
    marca: filters.marca || 'Todas',
    // ... otros filtros activos
  };
}
```

---

## **COMPLEJIDAD Y RIESGOS**

### **Estimación de esfuerzo**

| Fase | Tarea | Líneas código | Tiempo estimado |
|------|-------|---------------|-----------------|
| 1 | Generador PDF base | ~400 líneas | 4-6 horas |
| 2 | Endpoint PDF individual | ~50 líneas | 30 min |
| 3 | Endpoint Batch ZIP | ~80 líneas | 1 hora |
| 4 | Botones UI (2 tabs) | ~150 líneas | 1 hora |
| 5 | Metadata filtros | ~50 líneas | 30 min |
| 6 | Testing 8 tablas | - | 2-3 horas |
| **TOTAL** | | **~730 líneas** | **9-12 horas** |

### **Riesgos principales**

1. **Subtotales jerárquicos complejos:**
   - Streamlit usa AgGrid con `aggFunc` personalizado
   - PDF estático debe calcular subtotales manualmente
   - 5 niveles en Vendedores: cálculo recursivo de variación %

2. **Formateo visual:**
   - ReportEngine de Streamlit usa templates HTML + wkhtmltopdf
   - pdf-lib es más bajo nivel (posicionamiento manual)
   - Replicar exactamente el formato Streamlit es difícil

3. **Performance batch:**
   - Generar 50+ PDFs en un batch puede tardar
   - ZIP puede ser pesado (>10MB)
   - Sin streaming, el endpoint puede timeout

4. **Variación % con base 0:**
   - Lógica de `∞` cuando objetivo = 0 pero real > 0
   - Debe replicarse exactamente como Streamlit

5. **Testing exhaustivo:**
   - 8 tablas distintas con estructuras diferentes
   - Cada tabla puede tener casos borde (0 filas, valores null, etc.)

---

## **DECISIÓN: NO IMPLEMENTAR PARCIAL**

### **Razones:**

1. **Sales Report Streamlit es la ancla sólida:**
   - Ya funciona y está probado en producción
   - Director/vendedores lo usan diariamente
   - Cualquier discrepancia visual/numérica causará confusión

2. **Paridad completa o nada:**
   - Una versión parcial (ej: solo 1 tabla, sin batch, subtotales incorrectos) **NO es paridad**
   - Genera expectativa incorrecta de funcionalidad equivalente
   - Mantenimiento de 2 lógicas divergentes es insostenible

3. **Complejidad no trivial:**
   - ReportEngine de Streamlit es ~500 líneas de lógica probada
   - Subtotales jerárquicos + variación % agregada es delicado
   - Formateo PDF manual con pdf-lib es laborioso

4. **Prioridad vs ROI:**
   - Si Streamlit ya funciona, ¿por qué duplicar esfuerzo?
   - Report Next.js puede enfocarse en otras ventajas (ej: velocidad, serverless, analytics)
   - PDF puede seguir siendo responsabilidad de Streamlit temporalmente

### **Recomendación:**

**Esperar a OT dedicada de "PORT COMPLETO PDF"** que incluya:
- Port completo de ReportEngine (Python → TypeScript)
- Testing exhaustivo de 8 tablas
- Validación visual side-by-side Streamlit vs Next.js
- Sign-off de Director antes de desplegar

**Mientras tanto:**
- Mantener Sales Report Streamlit para PDFs
- Report Next.js se enfoca en analytics en pantalla (ya implementado)

---

## **PRÓXIMOS PASOS (SI SE APRUEBA IMPLEMENTACIÓN)**

1. **Crear OT nueva:** `OT-REPORT-SALES-PDF-FULL-PORT-009`
2. **Scope completo:**
   - Port ReportEngine
   - 8 tablas con PDF individual
   - 2 batch ZIP (Marcas, Vendedores)
   - Testing matriz (8 tablas × 3 escenarios = 24 casos)
3. **Criterio de aceptación:**
   - PDF Next.js visualmente idéntico a Streamlit
   - Números exactamente iguales (sin diferencias de redondeo)
   - Batch ZIP genera mismo count de archivos
   - Performance <30s para batch de 50 PDFs

---

## **CONCLUSIÓN**

**OT-REPORT-SALES-PDF-PARIDAD-STREAMLIT-008: MAPEO COMPLETADO**

✅ **Logros:**
- Identificadas 8 tablas con PDF en Streamlit
- Mapeadas funciones clave: `generate_general_report`, `export_batch_zip`
- Documentadas jerarquías de 5 niveles
- Plan de implementación por fases diseñado

❌ **No implementado:**
- Código de generador PDF
- Endpoints API
- Botones UI
- Testing

🎯 **Decisión:**
**NO implementar versión parcial ahora. Esperar a OT de port completo con testing exhaustivo.**

**Sales Report Streamlit sigue siendo fuente de verdad para PDFs hasta nuevo aviso.**

---

**Documento generado:** 2026-05-31  
**MARTA2 — Ejecutora técnica frente Report**
