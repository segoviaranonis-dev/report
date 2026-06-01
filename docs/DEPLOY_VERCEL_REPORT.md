# Guía de Despliegue — Report (RIMEC) en Vercel

**Proyecto:** Report — RIMEC Sales Report + Retail + Ventas con Fotos  
**Framework:** Next.js 15  
**Repo GitHub:** https://github.com/segoviaranonis-dev/report.git

---

## **Pre-requisitos**

1. ✅ Cuenta Vercel (vercel.com) con acceso a GitHub
2. ✅ Repo `segoviaranonis-dev/report` pusheado a GitHub
3. ✅ Credenciales PostgreSQL (DATABASE_URL)
4. ✅ Credenciales Supabase para Storage de imágenes
5. ⚠️ Base de datos debe estar accesible desde internet (Vercel serverless)

---

## **Paso 1: Conectar Repositorio en Vercel**

### **1.1 Crear Nuevo Proyecto**
1. Ir a https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. En "Import Git Repository":
   - Buscar: `segoviaranonis-dev/report`
   - Click **"Import"**

### **1.2 Configurar Proyecto**

**Project Name:**
```
report
```
(o `rimec-report` si "report" está ocupado)

**Framework Preset:**
```
Next.js
```
(Vercel lo detecta automáticamente)

**Root Directory:**
```
./
```
(dejar vacío = raíz del repo)

**Build and Output Settings:**
- Build Command: `npm run build` (default)
- Output Directory: `.next` (default)
- Install Command: `npm install` (default)

**NO modificar** — Next.js usa configuración estándar.

---

## **Paso 2: Variables de Entorno**

En **Environment Variables** de Vercel, agregar:

### **🔴 CRÍTICAS (PostgreSQL)**

| Variable | Valor | Entorno |
|----------|-------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Production |

**Formato completo:**
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

**Ejemplo:**
```
postgresql://rimec_user:Sup3rS3cr3t@db.example.com:5432/rimec_prod?sslmode=require
```

**⚠️ IMPORTANTE:**
- **NO usar** `NEXT_PUBLIC_` para DATABASE_URL (es secreto server-side)
- Conexión debe soportar SSL (`?sslmode=require`)
- Vercel serverless requiere connection pooling (ej: Supabase Pooler, Neon, PlanetScale)

**Dónde obtener:**
- Si usas Supabase PostgreSQL: Project Settings → Database → Connection String (Pooling mode)
- Si usas otra BD: proveedor debe dar connection string compatible con serverless

---

### **Obligatorias (Supabase Storage)**

| Variable | Valor | Entorno |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_REF.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon key de Supabase | Production, Preview, Development |

**Para qué:**
- Módulo `/ventas-fotos` carga imágenes desde Supabase Storage
- Bucket: `productos` (fotos de productos)

**Dónde obtener:**
1. Supabase → **Settings** → **API**
2. Copiar:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

### **Opcionales (Demo/Testing)**

| Variable | Valor | Uso |
|----------|-------|-----|
| `NEXT_PUBLIC_SAMPLE_PRODUCT_PATH` | `carpeta/archivo.jpg` | Path relativo en bucket "productos" para demos |
| `NEXT_PUBLIC_DEMO_IMAGE_URL` | URL completa | Sobreescribe SAMPLE_PRODUCT_PATH |

**Solo agregar si:**
- Querés mostrar imagen de demo en `/retail` sin BD
- Testing visual de Storage

**En producción:** NO son necesarias (se usan datos reales de BD).

---

## **Paso 3: Deploy**

1. Click **"Deploy"**
2. Esperar build (~3-5 min — más lento que bazzar-web porque tiene más módulos)
3. Si falla, revisar logs en **"Build Logs"**

**Build exitoso:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

---

## **Paso 4: Verificación Post-Deploy**

### **4.1 URL del Proyecto**
```
https://report.vercel.app
```
(o el dominio asignado)

### **4.2 Checklist Funcional**

| Ruta | Qué verificar | ✓ |
|------|---------------|---|
| `/` | Landing page carga | ☐ |
| `/rimec` | Sales Report carga (si DATABASE_URL OK) | ☐ |
| `/rimec` → Tab Dashboard | KPIs muestran datos reales | ☐ |
| `/rimec` → Tab Clientes | Tabla jerárquica carga | ☐ |
| `/rimec` → Tab Marcas | Ranking de marcas carga | ☐ |
| `/rimec` → Tab Vendedores | Gestión detallada carga | ☐ |
| `/retail` | Módulo retail carga | ☐ |
| `/retail` → Stock Board | Tabla de stock carga | ☐ |
| `/ventas-fotos` | Módulo ventas con fotos carga | ☐ |
| `/ventas-fotos` → Filtros | Dropdown marcas carga desde BD | ☐ |
| `/ventas-fotos` → Aplicar filtros | Tabla con fotos carga | ☐ |
| `/aprobaciones` | Módulo aprobaciones carga (revalidate 30s) | ☐ |

---

### **4.3 Validación Técnica**

**Console del navegador (F12):**

✅ **Esperado:**
- Requests a `/api/rimec/full-snapshot`: status 200
- Requests a `/api/retail/stock-board`: status 200
- Requests a Supabase Storage: status 200

❌ **NO debe haber:**
- Errores de conexión PostgreSQL (`ECONNREFUSED`)
- Errores de timeout (`ETIMEDOUT`)
- Errores de SSL (`SSL required`)
- Errores de CORS desde Supabase

**Network tab:**
- API `/api/rimec/*`: 200 OK (o 404 si no configurado)
- Imágenes: 200 desde `https://TU_REF.supabase.co/storage/...`

---

### **4.4 Verificación de Datos Reales**

**Si DATABASE_URL está configurado:**

1. Abrir `/rimec`
2. Aplicar filtros (periodo, vendedor, etc.)
3. Click **"Sincronizar"**
4. Verificar:
   - KPIs muestran números (no "0" ni mock)
   - Tabla Clientes tiene filas reales
   - Nombres de clientes/vendedores son reales (no "Cliente demo")

**Si DATABASE_URL NO está:**
- `/rimec` debe mostrar mensaje: "DATABASE_URL no configurada. Modo demostración."
- `/retail` puede mostrar datos mock
- `/ventas-fotos` muestra mensaje de configuración

---

## **Paso 5: Dominio Personalizado (Opcional)**

Si querés usar `report.nexus.com.py`:

1. Vercel → **Settings** → **Domains**
2. Agregar: `report.nexus.com.py`
3. Vercel te da records DNS (CNAME)
4. Configurar en tu proveedor DNS:
   ```
   CNAME report cname.vercel-dns.com
   ```
5. Esperar propagación (5-10 min)

---

## **Troubleshooting**

### **Error: "Failed to connect to database"**

**Causa:** DATABASE_URL incorrecta o BD no accesible desde Vercel.

**Solución:**
1. Verificar format: `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require`
2. Verificar BD acepta conexiones externas (no solo localhost)
3. Si usas Supabase: usar **Pooling mode** connection string (no Direct)
4. Si usas IP whitelist: agregar IPs de Vercel (0.0.0.0/0 o específicas)

---

### **Error: "SSL connection required"**

**Causa:** BD requiere SSL pero connection string no lo especifica.

**Solución:**
- Agregar al final de DATABASE_URL: `?sslmode=require`
- O si ya tiene otros params: `&sslmode=require`

---

### **Error: "Too many connections"**

**Causa:** Vercel serverless abre muchas conexiones concurrentes.

**Solución:**
1. Usar connection pooler (ej: Supabase Pooler, PgBouncer)
2. En Supabase: usar connection string de **"Connection Pooling"** (puerto 6543)
3. Configurar `pool: { max: 10 }` en código si hace falta

---

### **"/rimec muestra datos mock en vez de reales"**

**Causa:** DATABASE_URL no configurada o query falla silenciosamente.

**Solución:**
1. Vercel → Settings → Environment Variables → verificar `DATABASE_URL` existe
2. Redeploy para que tome la variable
3. Abrir `/rimec` → F12 Console → buscar errores de API
4. Vercel → Functions → Logs → buscar errores de `/api/rimec/*`

---

### **Imágenes en /ventas-fotos no cargan (404)**

**Causa:** Bucket Supabase Storage no es público o RLS bloquea.

**Solución:**
1. Supabase → Storage → Bucket `productos` → Make Public
2. Verificar que filas en BD tengan `image_url` correcto
3. Test directo: abrir URL imagen en navegador

---

### **Build falla con error TypeScript**

**Solución:**
1. Correr localmente: `npm run build`
2. Arreglar errores (el build de Vercel es idéntico al local)
3. Push y redeploy

---

## **Paso 6: Monitoreo Post-Deploy**

### **Logs en tiempo real**
Vercel → **Functions** → **Logs**

Buscar:
- Errores de BD (`Error: connect ETIMEDOUT`)
- Queries lentas (`[SQL] query took 5000ms`)
- Errores de API routes

### **Performance**
Vercel → **Analytics** (plan Pro+) o **Speed Insights**

Métricas clave:
- Tiempo de respuesta `/api/rimec/full-snapshot` < 3s
- Tiempo de respuesta `/api/retail/stock-board` < 2s
- No timeouts (Vercel tiene límite 10s para Hobby plan)

---

## **Mantenimiento**

### **Actualizar Deploy**
Cualquier push a branch `main` en GitHub → auto-deploy en Vercel.

### **Preview Deployments**
Cualquier PR → Vercel genera preview URL con BD de test (si configuras DATABASE_URL en Preview environment).

### **Rollback**
Vercel → **Deployments** → Click deploy anterior → **"Promote to Production"**

### **Actualizar Variables**
Vercel → **Settings** → **Environment Variables** → Editar → **Redeploy** para aplicar.

---

## **Configuración Avanzada (Opcional)**

### **Revalidación de datos**
Ya configurado en código:
- `/aprobaciones`: revalidate 30s (ISR)
- Otros módulos: On-demand (fetch fresh cada request)

### **Edge Functions (si hace falta)**
Para queries super rápidas, convertir API routes a Edge runtime:
```typescript
export const runtime = 'edge'
```
(No recomendado para queries PostgreSQL complejas)

---

## **Contacto de Emergencia**

**Errores críticos post-deploy:**
1. Rollback a deploy anterior
2. Revisar logs: Vercel → Functions → Logs
3. Verificar DATABASE_URL no cambió

**PostgreSQL down:**
- Verificar status del proveedor (Supabase, Neon, etc.)
- Tener backup connection string de emergencia

**Vercel down:**
- Status: https://www.vercel-status.com

---

## **Checklist Final Pre-Go-Live**

- [ ] DATABASE_URL configurada y testeada
- [ ] `/rimec` carga datos reales (no mock)
- [ ] Todos los módulos (/rimec, /retail, /ventas-fotos, /aprobaciones) abren sin error
- [ ] Imágenes en /ventas-fotos cargan desde Supabase
- [ ] Console navegador sin errores críticos
- [ ] Logs de Vercel Functions sin errores de conexión
- [ ] Performance <3s en queries principales
- [ ] Dominio personalizado configurado (si aplica)

---

**Última actualización:** 2026-05-31  
**Responsable técnico:** MARTA2
