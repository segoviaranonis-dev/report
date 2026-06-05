# Plan: Generador PDF Profesional para Retail Stock

**Fecha:** 2026-06-05  
**Objetivo:** Sistema robusto de PDF para catálogo retail, al nivel de ventas-fotos  
**Estimado:** 4-6 horas de trabajo enfocado

---

## 1. Análisis del Diseño

### Contenido del PDF:
- **Header por página:**
  - Título: "Reporte Ventas - Stock"
  - Subtítulo: Nombre del lote
  - Fecha de generación
  - Logo/branding RIMEC

- **Cuerpo (tarjetas):**
  - 6 tarjetas por página (2 filas × 3 columnas)
  - Cada tarjeta contiene:
    * Imagen del producto (cuadrada)
    * Ranking (#1, #2, etc)
    * Badge "VENTA"
    * Pares vendidos
    * Nombre de archivo/referencia
    * Badges de tiendas (Fernando, Palma, San Martín)
    * Badge principal (VENTA VIZZANO, etc)
    * Tablas de tallas por tienda (Venta/Stock)
    * Tabla importadora (si aplica)

- **Footer por página:**
  - "RIMEC · Informe Retail"
  - Fecha y hora de generación
  - "Pág. X de Y"

### Layout objetivo:
```
┌─────────────────────────────────────┐
│ Header: Título, lote, fecha         │
├─────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐            │
│  │ T1 │  │ T2 │  │ T3 │            │
│  └────┘  └────┘  └────┘            │
│                                     │
│  ┌────┐  ┌────┐  ┌────┐            │
│  │ T4 │  │ T5 │  │ T6 │            │
│  └────┘  └────┘  └────┘            │
├─────────────────────────────────────┤
│ Footer: RIMEC, fecha, pág           │
└─────────────────────────────────────┘
```

---

## 2. Stack Técnico

**Usar:**
- ✅ `pdf-lib` (como ventas-fotos) - NO html2canvas
- ✅ Layout manual con coordenadas exactas
- ✅ StandardFonts de pdf-lib
- ✅ Caché de imágenes
- ✅ Barra de progreso en cliente
- ✅ Logging de métricas

**Arquitectura:**
```
RetailStockClient.tsx
  ↓ (onClick botón)
  ↓
generarPDFRetail(columnas, batchLabel, onProgress)
  ↓
  ├─ Preparar datos
  ├─ Crear PDFDocument
  ├─ Para cada página (6 tarjetas):
  │    ├─ drawHeader()
  │    ├─ drawTarjetas() → 6 tarjetas en grid
  │    └─ drawFooter()
  ├─ Descargar PDF
  └─ Log métricas
```

---

## 3. Plan de Implementación

### Fase 1: Estructura Base (1h)
- [ ] Crear `src/lib/retail/pdfGeneratorRetail.ts`
- [ ] Definir tipos TypeScript
- [ ] Funciones helpers (text, textRight, textCenter, ruleLine)
- [ ] Constantes de página (A4 portrait, márgenes)
- [ ] Paleta de colores RIMEC

### Fase 2: Header y Footer (30min)
- [ ] `drawHeader()` - título, lote, fecha
- [ ] `drawFooter()` - branding, timestamp, paginación
- [ ] Aplicar en todas las páginas

### Fase 3: Layout de Tarjetas (2h)
- [ ] Calcular grid 2×3 (posiciones X,Y de cada tarjeta)
- [ ] `drawTarjeta()` para una tarjeta individual:
  - [ ] Caja con borde y sombra
  - [ ] Imagen del producto (con caché)
  - [ ] Badges (ranking, VENTA)
  - [ ] Texto: pares, nombre archivo
  - [ ] Badges de tiendas
  - [ ] Badge principal (marca/línea)
  - [ ] Tablas de tallas (simplificadas para PDF)
- [ ] Manejo de imágenes cross-origin
- [ ] Fallback si imagen no carga

### Fase 4: Lógica de Paginación (1h)
- [ ] Dividir columnas en batches de 6
- [ ] Loop por batches → crear página por cada uno
- [ ] Renderizar 6 tarjetas en grid por página
- [ ] Actualizar footers con total de páginas

### Fase 5: Barra de Progreso (30min)
- [ ] Callback `onProgress(current, total)`
- [ ] Actualizar en RetailStockClient
- [ ] Mostrar barra visual durante generación
- [ ] Deshabilitar botón durante proceso

### Fase 6: Métricas y Logging (30min)
- [ ] Console logs con timestamps
- [ ] Métricas: tiempo, páginas, imágenes, tamaño KB
- [ ] Error handling robusto

### Fase 7: Testing y Refinamiento (1h)
- [ ] Probar con 6, 12, 30, 60 tarjetas
- [ ] Verificar proporciones de imágenes
- [ ] Ajustar tamaños de fuente si es necesario
- [ ] Verificar colores y branding
- [ ] Cross-browser testing

---

## 4. Implementación de Barra de Progreso

```tsx
// En RetailStockClient.tsx
const [pdfProgress, setPdfProgress] = useState<{show: boolean, current: number, total: number}>({
  show: false,
  current: 0,
  total: 0
});

// Durante generación:
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white p-6 rounded-lg">
    <p>Generando PDF...</p>
    <div className="w-64 h-2 bg-gray-200 rounded">
      <div className="h-2 bg-report-navy rounded" 
           style={{width: `${(pdfProgress.current/pdfProgress.total)*100}%`}} />
    </div>
    <p>{pdfProgress.current} de {pdfProgress.total} tarjetas</p>
  </div>
</div>
```

---

## 5. Criterios de Éxito

✅ PDF se ve profesional (nivel ventas-fotos)  
✅ Tarjetas con proporciones correctas  
✅ Imágenes nítidas y centradas  
✅ Textos legibles (no comprimidos)  
✅ Barra de progreso funcional  
✅ Genera en < 5 segundos para 30 tarjetas  
✅ Headers/footers en todas las páginas  
✅ Logging de métricas en consola  
✅ Manejo robusto de errores  

---

## 6. Próximos Pasos

1. ✅ Aprobar este plan
2. Crear archivo base pdfGeneratorRetail.ts
3. Implementar Fase 1 (estructura)
4. Iteración por fases
5. Testing continuo
6. Deploy cuando esté al 100%

---

**Notas:**
- NO usar html2canvas - Layout manual con pdf-lib
- Seguir patrón de ventas-fotos (código probado)
- Priorizar calidad sobre velocidad de implementación
- Testing exhaustivo antes de dar por terminado
