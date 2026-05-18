# Deploy a Vercel - Informe de Ventas RIMEC

## Requisitos previos

1. Cuenta en Vercel (https://vercel.com)
2. Repositorio Git del proyecto
3. Acceso a las credenciales de Supabase

---

## Paso 1: Preparar el repositorio

```bash
# Asegúrate de que el proyecto esté en Git
git init
git add .
git commit -m "Aplicación RIMEC - Informe de Ventas lista para deploy"

# Subir a GitHub/GitLab/Bitbucket
git remote add origin <URL-DE-TU-REPO>
git push -u origin main
```

---

## Paso 2: Importar en Vercel

1. Ve a https://vercel.com/new
2. Selecciona "Import Git Repository"
3. Autoriza el acceso a tu proveedor de Git (GitHub/GitLab/Bitbucket)
4. Selecciona el repositorio `report`

---

## Paso 3: Configurar el proyecto

### Framework Preset
- **Framework:** Next.js
- **Root Directory:** `./` (o `report/` si está en un monorepo)

### Build Command
```bash
npm run build
```

### Install Command
```bash
npm install
```

### Output Directory
```
.next
```

---

## Paso 4: Variables de Entorno

### Variables REQUERIDAS

En la sección "Environment Variables" de Vercel, agregar:

```env
# URL de Supabase (pública)
NEXT_PUBLIC_SUPABASE_URL=https://extrlcvcgypwazxipvqm.supabase.co

# Anon Key de Supabase (pública, solo lecturas con RLS)
NEXT_PUBLIC_SUPABASE_ANON_KEY=<TU_SUPABASE_ANON_KEY>

# Connection String de PostgreSQL (PRIVADA - solo servidor)
DATABASE_URL=postgres://postgres.extrlcvcgypwazxipvqm:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Variables OPCIONALES

```env
# Ruta de imagen de producto demo (opcional)
NEXT_PUBLIC_SAMPLE_PRODUCT_PATH=carpeta/imagen.jpg

# O URL completa de imagen demo (opcional)
NEXT_PUBLIC_DEMO_IMAGE_URL=https://example.com/image.jpg
```

### ⚠️ IMPORTANTE - Seguridad

- **NUNCA** uses `service_role` key en variables públicas (`NEXT_PUBLIC_*`)
- **SOLO** usa `anon` key para el cliente
- La `DATABASE_URL` NO debe tener prefijo `NEXT_PUBLIC_` (es privada)

---

## Paso 5: Configuración de dominio (opcional)

### Dominio personalizado

1. Ve a **Settings → Domains** en tu proyecto Vercel
2. Agrega tu dominio: `informes.rimec.com.py`
3. Sigue las instrucciones para configurar DNS:
   - **CNAME**: `cname.vercel-dns.com`
   - O **A**: IPs proporcionadas por Vercel

---

## Paso 6: Deploy

1. Click en **"Deploy"**
2. Espera a que termine el build (~2-3 minutos)
3. Una vez completado, obtendrás una URL tipo: `https://tu-proyecto.vercel.app`

---

## Verificación Post-Deploy

### 1. Verificar APIs

```bash
# Meta endpoint (debe devolver categorías y tipos)
curl https://tu-proyecto.vercel.app/api/rimec/meta

# Debe devolver:
{
  "configured": true,
  "categorias": [...],
  "tipos": [...]
}
```

### 2. Verificar funcionalidad

1. Abre `https://tu-proyecto.vercel.app`
2. Click en "Ir a RIMEC"
3. Selecciona filtros:
   - Objetivo: 10%
   - Tipo: CALZADOS
   - Meses: Enero, Febrero
   - Categoría: PROGRAMADO
4. Click "Consultar informe"
5. Deberías ver:
   - ✅ 3 KPIs (Clientes activos, Atendimiento, Variación global)
   - ✅ Evolución mensual
   - ✅ Pestañas: Dashboard, Clientes, Marcas, Vendedores

### 3. Verificar exportación PDF

1. En cualquier tabla, click botón "PDF"
2. Debe abrir el diálogo de impresión del navegador
3. Selecciona "Guardar como PDF"
4. Verifica que el PDF incluya:
   - ✅ Encabezado con fecha y título
   - ✅ Filtros aplicados
   - ✅ Tablas con datos
   - ✅ Colores y formato

---

## Troubleshooting

### Error: "DATABASE_URL no configurada"

**Solución:** Verifica que `DATABASE_URL` esté en las variables de entorno de Vercel (sin prefijo `NEXT_PUBLIC_`)

### Error: "configured: false"

**Causa:** La aplicación no puede conectarse a la BD

**Solución:**
1. Verifica que `DATABASE_URL` esté correcta
2. Verifica que el password sea correcto
3. Verifica que incluya `?sslmode=require` al final

### Error: No aparecen las tablas

**Causa:** Falta consultar el informe o los filtros son muy restrictivos

**Solución:**
1. Selecciona al menos un mes
2. Selecciona al menos una categoría
3. Click "Consultar informe"

### Performance lento

**Causa:** Query muy pesado o BD remota lenta

**Solución:**
1. Agrega filtros más restrictivos (menos meses, cliente específico)
2. Considera agregar índices en la BD:
   ```sql
   CREATE INDEX idx_ventas_fecha ON registro_ventas_general_v2(fecha);
   CREATE INDEX idx_ventas_tipo ON registro_ventas_general_v2(id_tipo);
   CREATE INDEX idx_ventas_categoria ON registro_ventas_general_v2(id_categoria);
   ```

---

## Actualizar deploy

### Deploy automático (recomendado)

Vercel re-deploya automáticamente cada vez que haces push a la rama `main`:

```bash
git add .
git commit -m "Actualización de funcionalidad X"
git push
```

### Deploy manual

1. Ve al dashboard de Vercel
2. Selecciona tu proyecto
3. Click en "Deployments"
4. Click "Redeploy" en el último deployment

---

## Monitoreo

### Logs

1. Ve a **Deployments → [último deploy] → Function Logs**
2. Busca errores en las APIs `/api/rimec/*`

### Analytics

1. Ve a **Analytics** para ver:
   - Visitas
   - Tiempo de carga
   - Errores

### Limits (plan gratuito)

- ✅ Builds: Ilimitados
- ⚠️ Serverless Functions: 100 GB-hours/mes
- ⚠️ Bandwidth: 100 GB/mes

Si superas los límites, considera:
- Upgrade a plan Pro ($20/mes)
- Cachear queries repetitivas
- Implementar ISR (Incremental Static Regeneration)

---

## Seguridad

### Variables sensibles

- ✅ `DATABASE_URL` está solo en servidor (no expuesta al cliente)
- ✅ Solo se usa `anon` key en el cliente
- ✅ RLS (Row Level Security) está activo en Supabase

### Recomendaciones

1. **Nunca** commitees `.env.local` al repo
2. **Siempre** usa variables de entorno de Vercel
3. **Rotá** las credenciales cada 90 días
4. **Monitoreá** los logs para detectar accesos sospechosos

---

## Próximos pasos

1. ✅ Deploy básico funcionando
2. 📊 Agregar gráficos (Recharts)
3. 🔄 Implementar cache para queries repetitivas
4. 📧 Notificaciones por email de informes
5. 🔐 Autenticación para usuarios

---

*NEXUS Core · Módulo de Informes · Deploy Guide v1.0*
