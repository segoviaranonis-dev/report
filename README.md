# RIMEC — capa de informes (Next.js + Vercel)

Panel ejecutivo para **ventas, stock y reposición**, con **presentación tipo informe institucional** (papel, tipografía sobria, secciones numeradas). Las imágenes de producto se sirven desde el **mismo Supabase Storage** que ya usa la operación (bucket `productos`, URLs públicas).

Streamlit sigue siendo el **centro de control** de importación y proceso; este proyecto es la cara dirección. **Sales Report web v1.0.0** (ruta `/rimec`) es la versión sellada del informe inmersivo + snapshot; `/rimec/clasico` conserva las ocho tablas estilo Streamlit.

## Roles de trabajo (juego de roles)

Ver [docs/MEMORIA_HOLDING_REPORT.md](./docs/MEMORIA_HOLDING_REPORT.md) (roles ADMIN/SU, módulos, datos Vercel, PDF, pilares).

## Requisitos

- Node 20+
- Proyecto Supabase existente (mismas URLs que en RIMEC)

## Puesta en marcha

```bash
cd report
copy .env.example .env.local   # Windows; en mac/linux: cp
```

Editá `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (solo `anon` en el navegador)
- Opcional: `NEXT_PUBLIC_SAMPLE_PRODUCT_PATH` — ruta dentro del bucket **`productos`**, p. ej. `mi-carpeta/foto.jpg`
- O `NEXT_PUBLIC_DEMO_IMAGE_URL` — URL pública completa a una imagen de prueba

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Vercel

1. Importá el repo (o subcarpeta `report` como root del proyecto).
2. Variables de entorno: mismas `NEXT_PUBLIC_*` que en `.env.local`.
3. `next.config.ts` ya permite `next/image` hacia el hostname de `NEXT_PUBLIC_SUPABASE_URL` bajo `/storage/v1/object/public/**`.

## Próximos pasos sugeridos

- API route o Server Actions que lean vistas SQL ya probadas en el motor Python.
- Barra de filtros (marca, línea, ref, material, color, fechas…) compartiendo vocabulario con web ventas / Bazzar.
- Gráficos (Recharts u otra lib) con loading states “pro”.
