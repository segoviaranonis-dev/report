# Implementación: Sistema de Carga Garantizada de Imágenes

**Fecha**: 2026-06-05  
**Estado**: ✅ IMPLEMENTADO en ventas-fotos | ⏳ PENDIENTE en retail  
**Responsable**: Claude Code Team

---

## 📦 Archivos Modificados

### 1. `src/lib/pdf/imageUrlValidator.ts` ✅ COMPLETO

**Cambios realizados:**

#### Nuevos tipos exportados:
```typescript
export type DeviceType = 'desktop' | 'tablet' | 'mobile'

export interface FetchImageOptions {
  deviceType?: DeviceType
  maxRetries?: number
  onProgress?: (attempt: number, maxAttempts: number, url: string) => void
  fallbackUrls?: string[]
}
```

#### Nuevas funciones:

1. **`detectDeviceType(): DeviceType`**
   - Detecta automáticamente el tipo de dispositivo
   - Basado en: user agent, touch support, screen size
   - Retorna: 'desktop' | 'tablet' | 'mobile'

2. **`getDeviceTimeout(deviceType: DeviceType): number`**
   - Desktop: 5000ms (5 segundos)
   - Tablet: 15000ms (15 segundos) ← LEY técnica
   - Mobile: 20000ms (20 segundos) ← LEY técnica

3. **`getConcurrencyLimit(deviceType: DeviceType): number`**
   - Desktop: 10 imágenes paralelas
   - Tablet: 3 imágenes paralelas
   - Mobile: 2 imágenes paralelas

4. **`safeFetchImageGarantizado(url, options): Promise<Response>`** ⭐ PRINCIPAL
   - Reemplaza a `safeFetchImage` con sistema robusto
   - Reintentos automáticos (mínimo 3)
   - Backoff exponencial: timeout × 1, × 1.5, × 2
   - Soporte para URLs fallback (thumbnails)
   - Logging detallado de cada intento
   - Callback de progreso para UI
   - **LANZA ERROR si fallan todos los intentos** (no retorna null)

5. **`safeFetchImage(url, timeoutMs)` - LEGACY**
   - Marcada como `@deprecated`
   - Mantiene compatibilidad llamando internamente a `safeFetchImageGarantizado`
   - Un solo intento, timeout configurable

---

### 2. `src/lib/ventas-fotos/pdfGenerator.ts` ✅ COMPLETO

**Cambios realizados:**

#### Import actualizado:
```typescript
// ANTES:
import { safeFetchImage } from '../pdf/imageUrlValidator'

// DESPUÉS:
import { detectDeviceType, safeFetchImageGarantizado } from '../pdf/imageUrlValidator'
```

#### Función `fetchImage` actualizada:
- Añadido parámetro `deviceType: 'desktop' | 'tablet' | 'mobile'`
- Usa `safeFetchImageGarantizado` con 3 reintentos
- Callback de progreso loggea en consola
- Mejor manejo de errores con logging crítico

#### Función `generarPDFVentasFotos` actualizada:
- Detecta dispositivo al inicio: `const deviceType = detectDeviceType()`
- Pasa `deviceType` a `renderDetalle`
- Loggea dispositivo detectado en consola

#### Función `renderDetalle` actualizada:
- Acepta parámetro `deviceType`
- Pasa `deviceType` a cada llamada de `fetchImage`

---

### 3. `src/lib/retail/pdfGeneratorRetail.ts` ⏳ PENDIENTE

**⚠️ NOTA PARA COLEGA**: Este archivo está siendo trabajado por otro dev.

**Instrucciones de migración:**

1. **Actualizar import**:
   ```typescript
   // Cambiar de:
   import { safeFetchImage } from '../pdf/imageUrlValidator'
   
   // A:
   import { detectDeviceType, safeFetchImageGarantizado } from '../pdf/imageUrlValidator'
   ```

2. **En función principal `generarPDFRetail`**:
   ```typescript
   // Detectar dispositivo al inicio
   const deviceType = detectDeviceType()
   console.log('[PDF Retail] Dispositivo detectado:', deviceType)
   ```

3. **Actualizar función de carga de imágenes**:
   ```typescript
   // ANTES:
   const resp = await safeFetchImage(url, 800)
   if (!resp) {
     // fallback
   }
   
   // DESPUÉS:
   try {
     const resp = await safeFetchImageGarantizado(url, {
       deviceType,
       maxRetries: 3,
       onProgress: (attempt, max, url) => {
         console.log(`[PDF Retail] Intento ${attempt}/${max}`)
       }
     })
     // usar resp
   } catch (error) {
     // Solo llega aquí si fallan TODOS los intentos
     console.error('[PDF Retail] FALLO CRÍTICO:', error)
     // fallback
   }
   ```

4. **Pasar `deviceType` en cascada** a todas las funciones que cargan imágenes

---

## 🎯 Comportamiento Nuevo vs Viejo

### Antes (sistema viejo):
```
1. fetch(url, timeout: 800ms)
2. Si falla → return null
3. Mostrar placeholder "S/IMG"
```

**Problema en tablets**: 800ms muy corto, muchas imágenes fallaban

---

### Después (sistema nuevo):
```
1. Detectar dispositivo → timeout = 5s/15s/20s
2. fetch(url, timeout)
3. Si falla → reintentar con timeout × 1.5
4. Si falla → reintentar con timeout × 2
5. Si todas las URLs fallan → lanzar error
6. Mostrar placeholder solo si ERROR CRÍTICO
```

**Ventaja**: En tablet con timeout 15s × 3 intentos = hasta 45s para cargar una imagen

---

## 📊 Logging Esperado

### En Desktop:
```
[PDF Ventas-Fotos] Iniciando generación...
[PDF Ventas-Fotos] Dispositivo detectado: desktop
[PDF Ventas-Fotos] Filas totales: 30
[PDF] Iniciando carga garantizada - Dispositivo: desktop, Timeout base: 5000ms, URLs disponibles: 1
[PDF] Probando URL principal: https://xxx.supabase.co/storage/.../img1.jpg
[PDF]   Intento 1/3 (timeout: 5000ms)
[PDF]   ✓ Éxito en 234ms
[PDF Ventas-Fotos] Descargando imagen - Dispositivo: desktop
[PDF Ventas-Fotos]   Intento 1/3 para img1.jpg
... (repetir para cada imagen)
[PDF Ventas-Fotos] ✓ PDF generado en 8432ms
[PDF Ventas-Fotos]   - Filas procesadas: 30
[PDF Ventas-Fotos]   - Imágenes descargadas: 28
[PDF Ventas-Fotos]   - Imágenes en caché: 2
[PDF Ventas-Fotos]   - Imágenes fallback: 0  ← CRÍTICO: debe ser 0
[PDF Ventas-Fotos]   - Tamaño: 1847KB
```

### En Tablet con red débil:
```
[PDF Ventas-Fotos] Iniciando generación...
[PDF Ventas-Fotos] Dispositivo detectado: tablet
[PDF] Iniciando carga garantizada - Dispositivo: tablet, Timeout base: 15000ms, URLs disponibles: 1
[PDF] Probando URL principal: https://xxx.supabase.co/storage/.../img1.jpg
[PDF]   Intento 1/3 (timeout: 15000ms)
[PDF]   ✗ URL principal intento 1/3: Timeout después de 15000ms (14998ms)
[PDF]   Intento 2/3 (timeout: 22500ms)  ← backoff × 1.5
[PDF]   ✓ Éxito en 18432ms
[PDF Ventas-Fotos] Descargando imagen - Dispositivo: tablet
[PDF Ventas-Fotos]   Intento 1/3 para img1.jpg
... (puede tardar varios minutos en total)
[PDF Ventas-Fotos] ✓ PDF generado en 124532ms  ← 2 minutos, ACEPTABLE
```

---

## ✅ Checklist de Implementación

### Ventas-Fotos (COMPLETO):
- [x] Import actualizado a `safeFetchImageGarantizado`
- [x] Detección de dispositivo en función principal
- [x] Timeout adaptativo según dispositivo
- [x] Reintentos con backoff exponencial
- [x] Logging detallado en consola
- [x] Callback de progreso implementado
- [x] Parámetro `deviceType` pasado en cascada
- [x] Manejo de errores críticos

### Retail (PENDIENTE - Para colega):
- [ ] Import actualizado a `safeFetchImageGarantizado`
- [ ] Detección de dispositivo en función principal
- [ ] Timeout adaptativo según dispositivo
- [ ] Reintentos con backoff exponencial
- [ ] Logging detallado en consola
- [ ] Callback de progreso implementado
- [ ] Parámetro `deviceType` pasado en cascada
- [ ] Manejo de errores críticos

---

## 🧪 Pruebas Requeridas

Ver archivo completo: `.claude/PRUEBAS_CARGA_IMAGENES_PDF.md`

**Prueba crítica obligatoria**:
- Generar PDF en tablet real con WiFi débil
- Verificar 0 placeholders "S/IMG" por timeout
- Verificar logging muestra reintentos
- Héctor debe aprobar personalmente antes de merge

---

## 📚 Referencias

- **LEY Técnica**: Integridad Visual PDF - Carga Garantizada
- **Especificación**: Definida en conversación con Héctor (2026-06-05)
- **Archivos de prueba**: `.claude/PRUEBAS_CARGA_IMAGENES_PDF.md`

---

## 🔄 Próximos Pasos

1. ✅ **Ventas-Fotos** - Implementación completa
2. ⏳ **Retail** - Esperar colega complete `pdfGeneratorRetail.ts`
3. 🧪 **Pruebas** - Héctor valida en su tablet
4. 📋 **Reporte** - Completar checklist de pruebas
5. ✅ **Merge** - Solo después de aprobación de Héctor

---

**Última actualización**: 2026-06-05  
**Próxima revisión**: Después de pruebas en tablet