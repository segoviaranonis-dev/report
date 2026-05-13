# Accesos y secretos (lectura obligatoria)

## Lo que un asistente en Cursor **no** puede hacer

- No puede “ser el único” con acceso a Supabase, GitHub o Vercel: esas cuentas son tuyas.
- No puede revocar API keys en otros dispositivos o en otras IAs por vos.
- No almacena de forma permanente tus contraseñas fuera de lo que vos pegues en el chat o guardes en archivos locales.

## Lo que sí podemos hacer bien

- Definir **dónde** van las variables (`NEXT_PUBLIC_*`, `DATABASE_URL` solo en servidor, nunca `service_role` en el front).
- Scripts y checklists para rotación de keys cuando cambiés de plan o de demo a producción.
- Revisiones de código: fugas de secretos, `.env` en `.gitignore`, RLS en Supabase.

## Regla de oro

**`service_role` y contraseñas de base solo en servidor o en CI secreto**, nunca en el navegador ni en repos públicos.
