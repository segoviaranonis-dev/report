# Agent memory - Report

## Rol del repo

`report` es una app cerrada de informes internos RIMEC en Next.js + Vercel.

Modulos principales:
- `/rimec`: Sales Report / gerencia.
- `/retail`: stock / retail.
- `/ventas-fotos`: ventas con fotos y PDF.
- `/aprobaciones`: gestion interna.

## Leyes de trabajo

- GitHub es la verdad central; la PC de Hector es taller; Vercel es vidriera.
- Report es app cerrada: siempre login, roles, APIs protegidas y logout visible.
- No hacer publica una ruta interna sin autorizacion explicita.
- No confiar en el navegador para stock, precio, aprobacion ni facturacion.
- APIs deben responder JSON para errores de auth, no HTML de login.
- `DATABASE_URL` es secreto server-side. Nunca usar `NEXT_PUBLIC_` para la base.
- `REPORT_SESSION_SECRET` firma sesiones. Si cambia el contrato de sesion, subir `REPORT_SESSION_VERSION`.
- `Sales Report` historico no debe depender de pilares; `Retail` y `Ventas Fotos` si pueden usar pilares para filtros/fotos.

## Prioridad actual

Report quedo casi cerrado. No romper:
- login
- roles
- logout
- `/ventas-fotos` con marcas, filtros, PDF

Antes de tocar codigo:
1. `git status`
2. revisar `README.md`
3. revisar `docs/MEMORIA_HOLDING_REPORT.md`
4. para Next, recordar que este repo usa Next 15

Validacion minima:
- `npm run build`
- probar ruta afectada en navegador si toca UI
- si toca auth, probar usuario sin sesion y roles permitidos/no permitidos
