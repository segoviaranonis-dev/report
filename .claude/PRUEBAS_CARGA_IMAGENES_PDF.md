# Pruebas: Sistema de Carga Garantizada de Imágenes en PDF

**Fecha**: 2026-06-05  
**Objetivo**: Validar que el sistema de carga garantizada funciona correctamente en todos los dispositivos

---

## 📋 Criterios de Aceptación

### ✅ Obligatorios

1. **100% de imágenes en PDF** - No se aceptan placeholders "S/IMG" por timeout
2. **Funciona en tablets con WiFi débil** - Red 2G/3G simulada (500 Kbps, 400ms latencia)
3. **Logging detallado** - Cada intento debe aparecer en consola
4. **Feedback al usuario** - Mostrar progreso durante carga
5. **Timeouts adaptativos**:
   - Desktop: 5 segundos base
   - Tablet: 15 segundos base
   - Mobile: 20 segundos base
6. **Reintentos automáticos**: Mínimo 3 intentos con backoff exponencial

---

## 🧪 Batería de Pruebas

### Prueba 1: Desktop con conexión rápida (Baseline)

**Entorno:**
- Dispositivo: PC/Laptop con Ethernet o WiFi fuerte
- Navegador: Chrome/Edge
- Red: Normal (sin throttling)

**Pasos:**
1. Abrir Report → Ventas con Fotos
2. Aplicar filtros para obtener ~30 productos con imágenes
3. Generar PDF
4. Abrir DevTools → Console

**Resultado esperado:**
- ✅ PDF se genera en <30 segundos
- ✅ Console muestra: `[PDF Ventas-Fotos] Dispositivo detectado: desktop`
- ✅ Todas las imágenes presentes (0 fallbacks)
- ✅ Métricas finales muestran "downloaded" + "cached" = total imágenes

---

### Prueba 2: Tablet con WiFi débil (Crítica - LEY)

**Entorno:**
- Dispositivo: iPad/Android Tablet REAL (no emulador)
- Navegador: Safari/Chrome móvil
- Red: WiFi débil o compartida (varios dispositivos)

**Pasos:**
1. Conectar tablet a WiFi corporativa con tráfico
2. Abrir Report → Ventas con Fotos
3. Aplicar filtros para obtener ~30 productos
4. Generar PDF
5. Abrir DevTools Remoto (Safari/Chrome Remote Debugging)

**Resultado esperado:**
- ✅ PDF se genera (puede tardar 60-180 segundos, es aceptable)
- ✅ Console muestra: `[PDF Ventas-Fotos] Dispositivo detectado: tablet`
- ✅ 100% imágenes presentes (crítico)
- ✅ Se ven intentos con reintentos: "Intento 1/3", "Intento 2/3", etc.
- ✅ NO debe fallar por timeout

**❌ Falla NO ACEPTABLE:**
- PDF con placeholders "S/IMG"
- Error "timeout" sin reintentos
- PDF incompleto

---

### Prueba 3: Desktop con throttling 3G (Simulación tablet)

**Entorno:**
- Dispositivo: Desktop
- Navegador: Chrome DevTools
- Red: Throttling "Fast 3G" o "Slow 3G"

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Activar "Fast 3G" throttling
3. Generar PDF con 30 productos

**Resultado esperado:**
- ✅ Dispositivo se detecta como "desktop" (no afecta)
- ✅ Imágenes tardan más pero TODAS se cargan
- ✅ Se ven reintentos si timeout inicial falla
- ✅ PDF completo sin placeholders

---

### Prueba 4: Saturación con 80 productos (Máximo)

**Entorno:**
- Dispositivo: Tablet real
- Red: WiFi normal

**Pasos:**
1. Generar PDF con filtros que den ~80 productos (máximo)
2. Observar consola y tiempos

**Resultado esperado:**
- ✅ Se genera exitosamente (puede tardar 3-5 minutos en tablet)
- ✅ 100% imágenes cargadas
- ✅ Logging muestra progreso claro
- ⚠️ Si falla por memoria: dividir en 2 PDFs de 40 (futuro)

---

### Prueba 5: Red intermitente (Edge case)

**Entorno:**
- Dispositivo: Cualquiera
- Red: Simular intermitencia (activar/desactivar WiFi durante generación)

**Pasos:**
1. Iniciar generación de PDF
2. Desactivar WiFi por 2-3 segundos
3. Reactivar WiFi

**Resultado esperado:**
- ✅ Sistema reintenta cuando vuelve la conexión
- ✅ PDF se completa (puede tardar más)
- ✅ Console muestra reintentos y errores temporales

---

## 📊 Métricas de Éxito

Al final de cada PDF, la consola debe mostrar:

```
[PDF Ventas-Fotos] ✓ PDF generado en XXXXms
[PDF Ventas-Fotos]   - Filas procesadas: XX
[PDF Ventas-Fotos]   - Imágenes descargadas: XX
[PDF Ventas-Fotos]   - Imágenes en caché: XX
[PDF Ventas-Fotos]   - Imágenes fallback: 0  ← DEBE SER 0
[PDF Ventas-Fotos]   - Tamaño: XXXKB
```

**Criterio crítico**: `Imágenes fallback: 0`

---

## 🔍 Debugging en Tablet Real

### Cómo ver la consola en tablet:

#### iPad (Safari):
1. En iPad: Ajustes → Safari → Avanzado → Activar "Web Inspector"
2. Conectar iPad a Mac con cable
3. En Mac: Safari → Develop → [tu iPad] → [página Report]
4. Ver consola en Mac

#### Android (Chrome):
1. Activar "Modo desarrollador" en Android
2. Conectar a PC con cable USB
3. En PC: Chrome → `chrome://inspect`
4. Seleccionar dispositivo y página
5. Ver consola en PC

---

## 🚨 Casos de Fallo Crítico

Si alguna imagen NO carga después de los 3 reintentos, el sistema debe:

1. **Registrar error detallado** en consola:
   ```
   [PDF Ventas-Fotos] FALLO CRÍTICO cargando imagen después de reintentos
   [PDF] ERROR CRÍTICO: No se pudo cargar imagen después de 9 intentos
   ```

2. **Mostrar en PDF**: Placeholder con borde rojo y texto "ERROR CRÍTICO"

3. **Causas posibles**:
   - Archivo eliminado del bucket Supabase
   - Servidor de imágenes caído
   - Conexión totalmente perdida
   - URL incorrecta en base de datos

---

## ✅ Checklist de Validación Final

Antes de dar por aprobado, verificar:

- [ ] Prueba 1 (Desktop rápido) - PASADA
- [ ] Prueba 2 (Tablet WiFi débil) - PASADA ← **CRÍTICA**
- [ ] Prueba 3 (Throttling 3G) - PASADA
- [ ] Prueba 4 (80 productos) - PASADA
- [ ] Prueba 5 (Red intermitente) - PASADA
- [ ] Métricas: 0 fallbacks en todos los casos normales
- [ ] Logging detallado visible en consola
- [ ] Timeouts correctos: desktop 5s, tablet 15s, mobile 20s
- [ ] Reintentos visibles en log: "Intento X/3"
- [ ] Código documentado y comentado

---

## 📝 Reporte de Pruebas

**Ejecutado por**: ________________  
**Fecha**: ________________  
**Dispositivo usado**: ________________  
**Red**: ________________  

### Resultados:

| Prueba | Estado | Observaciones |
|--------|--------|---------------|
| 1. Desktop rápido | ⬜ PASS / ⬜ FAIL | |
| 2. Tablet WiFi débil | ⬜ PASS / ⬜ FAIL | |
| 3. Throttling 3G | ⬜ PASS / ⬜ FAIL | |
| 4. 80 productos | ⬜ PASS / ⬜ FAIL | |
| 5. Red intermitente | ⬜ PASS / ⬜ FAIL | |

**Firma Héctor**: ________________  
**Aprobado para merge**: ⬜ SÍ / ⬜ NO