/**
 * Bitácora monitoreo · sesión + venta + semana L–V
 * CHUSAR 2.3.1.51 · MIG-201/202
 */

import { getRimecPool, isRimecDatabaseConfigured } from '@/lib/rimec/pool'

export type BitacoraEvento =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VENTA_ACTIVA'
  | 'VENTA_CERRADA'
  | 'HEARTBEAT'

export type DiaClave = 'lun' | 'mar' | 'mie' | 'jue' | 'vie'

export type DiaCelda = {
  clave: DiaClave
  label: string
  fecha: string
  trabajo: boolean
  online: boolean
  texto: string
  apps: string[]
}

export type MonitoreoUsuarioRow = {
  id_usuario: number
  descp_usuario: string
  categoria: string
  rol_id: number
  bloqueado: boolean
  ente_label: string | null
  ultimo_login_at: string | null
  ultimo_login_app: string | null
  sesion_hoy: boolean
  online_ahora: boolean
  venta_activa: boolean
  venta_cliente: string | null
  venta_desde: string | null
  venta_horas: number | null
  items_carrito: number
  dias: DiaCelda[]
}

export type MonitoreoGrupo = {
  key: string
  titulo: string
  subtitulo: string
  usuarios: MonitoreoUsuarioRow[]
  bloqueados: MonitoreoUsuarioRow[]
}

export type SemanaMeta = {
  lunes: string
  viernes: string
  labels: { clave: DiaClave; label: string; fecha: string }[]
}

const DIA_LABELS: { clave: DiaClave; label: string }[] = [
  { clave: 'lun', label: 'Lunes' },
  { clave: 'mar', label: 'Martes' },
  { clave: 'mie', label: 'Miércoles' },
  { clave: 'jue', label: 'Jueves' },
  { clave: 'vie', label: 'Viernes' },
]

const DDL = `
CREATE TABLE IF NOT EXISTS public.bitacora_acceso_web (
  id              bigserial PRIMARY KEY,
  id_usuario      integer NOT NULL REFERENCES public.usuario_v2 (id_usuario),
  app             text NOT NULL DEFAULT 'rimec-web',
  evento          text NOT NULL,
  detalle         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bitacora_acceso_web_usuario_created
  ON public.bitacora_acceso_web (id_usuario, created_at DESC);
`

let tableReady = false

export async function ensureBitacoraAccesoTable(): Promise<void> {
  if (tableReady || !isRimecDatabaseConfigured()) return
  const pool = getRimecPool()
  await pool.query(DDL)
  await pool.query(`
    ALTER TABLE public.bitacora_acceso_web
      DROP CONSTRAINT IF EXISTS bitacora_acceso_web_evento_chk
  `).catch(() => undefined)
  tableReady = true
}

export async function registrarAccesoWeb(opts: {
  id_usuario: number
  app: string
  evento: BitacoraEvento
  detalle?: Record<string, unknown> | null
}): Promise<void> {
  if (!isRimecDatabaseConfigured() || !opts.id_usuario) return
  try {
    await ensureBitacoraAccesoTable()
    const pool = getRimecPool()
    await pool.query(
      `
      INSERT INTO bitacora_acceso_web (id_usuario, app, evento, detalle)
      VALUES ($1, $2, $3, $4::jsonb)
      `,
      [
        opts.id_usuario,
        opts.app || 'report',
        opts.evento,
        opts.detalle ? JSON.stringify(opts.detalle) : null,
      ],
    )
  } catch (e) {
    console.warn('[bitacora_acceso_web] registro omitido:', e)
  }
}

/**
 * Presencia: 1 LOGIN por día/app si no hubo; HEARTBEAT como máximo cada ~4 min.
 * Sirve para detectar BZZP (y todos) sin forzar re-login.
 */
export async function registrarPresenciaWeb(opts: {
  id_usuario: number
  app: string
  descp_usuario?: string
}): Promise<{ evento: BitacoraEvento | 'SKIP'; ok: boolean }> {
  if (!isRimecDatabaseConfigured() || !opts.id_usuario) {
    return { evento: 'SKIP', ok: false }
  }
  try {
    await ensureBitacoraAccesoTable()
    const pool = getRimecPool()
    const app = opts.app || 'report'

    const { rows: hoy } = await pool.query<{ id: number }>(
      `
      SELECT id FROM bitacora_acceso_web
      WHERE id_usuario = $1
        AND app = $2
        AND evento IN ('LOGIN', 'HEARTBEAT')
        AND (created_at AT TIME ZONE 'America/Asuncion')::date
          = (now() AT TIME ZONE 'America/Asuncion')::date
      LIMIT 1
      `,
      [opts.id_usuario, app],
    )

    if (hoy.length === 0) {
      await pool.query(
        `
        INSERT INTO bitacora_acceso_web (id_usuario, app, evento, detalle)
        VALUES ($1, $2, 'LOGIN', $3::jsonb)
        `,
        [
          opts.id_usuario,
          app,
          JSON.stringify({
            descp_usuario: opts.descp_usuario ?? null,
            via: 'presencia',
          }),
        ],
      )
      return { evento: 'LOGIN', ok: true }
    }

    const { rows: recent } = await pool.query<{ id: number }>(
      `
      SELECT id FROM bitacora_acceso_web
      WHERE id_usuario = $1
        AND app = $2
        AND evento IN ('LOGIN', 'HEARTBEAT')
        AND created_at > now() - interval '4 minutes'
      LIMIT 1
      `,
      [opts.id_usuario, app],
    )
    if (recent.length > 0) return { evento: 'SKIP', ok: true }

    await pool.query(
      `
      INSERT INTO bitacora_acceso_web (id_usuario, app, evento, detalle)
      VALUES ($1, $2, 'HEARTBEAT', $3::jsonb)
      `,
      [
        opts.id_usuario,
        app,
        JSON.stringify({ descp_usuario: opts.descp_usuario ?? null }),
      ],
    )
    return { evento: 'HEARTBEAT', ok: true }
  } catch (e) {
    console.warn('[bitacora_acceso_web] presencia omitida:', e)
    return { evento: 'SKIP', ok: false }
  }
}

function grupoKey(u: MonitoreoUsuarioRow): string {
  const cat = (u.categoria || '').trim().toUpperCase()
  if (u.rol_id === 2) return 'BAZZAR'
  if (cat === 'DIOS') return 'DIOS'
  if (cat === 'ADMIN' || cat === 'GERENTE') return 'ADMIN'
  if (cat === 'VENDEDOR') return 'VENDEDOR'
  if (cat === 'CAJA') return 'CAJA'
  if (cat.includes('CONFEC') || cat === '638') return 'CONFEC'
  return cat || 'OTROS'
}

function metaGrupo(key: string): { titulo: string; subtitulo: string } {
  switch (key) {
    case 'DIOS':
      return { titulo: 'DIOS', subtitulo: 'rol 1 · cat DIOS · catálogo libre' }
    case 'ADMIN':
      return { titulo: 'ADMIN RIMEC', subtitulo: 'rol 1 · cat ADMIN' }
    case 'BAZZAR':
      return {
        titulo: 'BAZZAR (Web + Report)',
        subtitulo: 'rol 2 · tiendas · ej. BZZP Palma A',
      }
    case 'VENDEDOR':
      return {
        titulo: 'VENDEDOR',
        subtitulo: 'RIMEC Web / Report · ventas con fotos según matriz',
      }
    case 'CAJA':
      return { titulo: 'CAJA', subtitulo: 'Facturación pronta entrega' }
    case 'CONFEC':
      return {
        titulo: 'Confecciones 638 (Web)',
        subtitulo: 'RIMEC Web: solo confecciones · 654 PROHIBIDO',
      }
    default:
      return { titulo: key, subtitulo: 'categoría operativa' }
  }
}

function horasDesde(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.round(((Date.now() - t) / 3_600_000) * 10) / 10)
}

function fmtHoraAsu(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Asuncion',
  })
}

export async function getSemanaMeta(): Promise<SemanaMeta> {
  if (!isRimecDatabaseConfigured()) {
    const today = new Date()
    return {
      lunes: today.toISOString().slice(0, 10),
      viernes: today.toISOString().slice(0, 10),
      labels: DIA_LABELS.map((d) => ({ ...d, fecha: today.toISOString().slice(0, 10) })),
    }
  }
  const pool = getRimecPool()
  const { rows } = await pool.query<{ d: string; i: number }>(`
    SELECT
      ((date_trunc('week', (now() AT TIME ZONE 'America/Asuncion')::timestamp)
        + (gs.i || ' days')::interval)::date)::text AS d,
      gs.i
    FROM generate_series(0, 4) AS gs(i)
  `)
  const labels = DIA_LABELS.map((meta, idx) => ({
    ...meta,
    fecha: rows.find((r) => Number(r.i) === idx)?.d ?? '',
  }))
  return {
    lunes: labels[0]?.fecha ?? '',
    viernes: labels[4]?.fecha ?? '',
    labels,
  }
}

export async function listMonitoreoUsuarios(): Promise<{
  grupos: MonitoreoGrupo[]
  semana: SemanaMeta
}> {
  const semana = await getSemanaMeta()
  if (!isRimecDatabaseConfigured()) return { grupos: [], semana }

  await ensureBitacoraAccesoTable()
  const pool = getRimecPool()

  const { rows: users } = await pool.query<{
    id_usuario: number
    descp_usuario: string
    categoria: string
    rol_id: number
    bloqueado: boolean
    ente_label: string | null
    ultimo_login_at: string | null
    ultimo_login_app: string | null
    sesion_hoy: boolean
    online_ahora: boolean
    venta_activa: boolean
    venta_cliente: string | null
    venta_desde: string | null
    items_carrito: number
  }>(`
    SELECT
      u.id_usuario,
      u.descp_usuario,
      COALESCE(u.categoria, '') AS categoria,
      u.rol_id,
      COALESCE(u.bloqueado, false) AS bloqueado,
      CASE
        WHEN e.nombre IS NOT NULL THEN TRIM(COALESCE(e.codigo || ' · ', '') || e.nombre)
        ELSE NULL
      END AS ente_label,
      COALESCE(ba.created_at, cs.iniciada_en, cs.actualizada_en)::text AS ultimo_login_at,
      COALESCE(ba.app, CASE WHEN cs.id_usuario IS NOT NULL THEN 'rimec-web(prod)' END) AS ultimo_login_app,
      (
        (
          ba.created_at IS NOT NULL
          AND (ba.created_at AT TIME ZONE 'America/Asuncion')::date
            = (now() AT TIME ZONE 'America/Asuncion')::date
        )
        OR (
          cs.id_usuario IS NOT NULL
          AND (
            (cs.iniciada_en AT TIME ZONE 'America/Asuncion')::date
              = (now() AT TIME ZONE 'America/Asuncion')::date
            OR (cs.actualizada_en AT TIME ZONE 'America/Asuncion')::date
              = (now() AT TIME ZONE 'America/Asuncion')::date
          )
        )
      ) AS sesion_hoy,
      (
        EXISTS (
          SELECT 1 FROM bitacora_acceso_web hb
          WHERE hb.id_usuario = u.id_usuario
            AND hb.evento IN ('LOGIN', 'HEARTBEAT')
            AND hb.created_at > now() - interval '10 minutes'
        )
        OR (
          cs.actualizada_en IS NOT NULL
          AND cs.actualizada_en > now() - interval '15 minutes'
        )
      ) AS online_ahora,
      (cs.id_usuario IS NOT NULL) AS venta_activa,
      cs.cliente_nombre AS venta_cliente,
      COALESCE(cs.iniciada_en, cs.actualizada_en)::text AS venta_desde,
      COALESCE((
        SELECT count(*)::int FROM carrito_item ci WHERE ci.id_usuario = u.id_usuario
      ), 0) AS items_carrito
    FROM usuario_v2 u
    LEFT JOIN entes e ON e.id_ente = u.ente_id
    LEFT JOIN LATERAL (
      SELECT b.created_at, b.app
      FROM bitacora_acceso_web b
      WHERE b.id_usuario = u.id_usuario AND b.evento IN ('LOGIN', 'HEARTBEAT')
      ORDER BY b.created_at DESC
      LIMIT 1
    ) ba ON true
    LEFT JOIN carrito_sesion cs ON cs.id_usuario = u.id_usuario
    ORDER BY u.descp_usuario
  `)

  // Días con LOGIN/HEARTBEAT + días con actividad de carrito (prod sin gancho LOGIN)
  const { rows: diaRows } = await pool.query<{
    id_usuario: number
    dia_idx: number
    primera: string
    ultima: string
    apps: string
  }>(`
    WITH bounds AS (
      SELECT date_trunc('week', (now() AT TIME ZONE 'America/Asuncion')::timestamp)::date AS lun
    ),
    eventos AS (
      SELECT
        b.id_usuario,
        b.created_at AS ts,
        b.app
      FROM bitacora_acceso_web b
      WHERE b.evento IN ('LOGIN', 'HEARTBEAT')
      UNION ALL
      SELECT
        cs.id_usuario,
        COALESCE(cs.iniciada_en, cs.actualizada_en) AS ts,
        'rimec-web(carrito)'::text AS app
      FROM carrito_sesion cs
      WHERE COALESCE(cs.iniciada_en, cs.actualizada_en) IS NOT NULL
      UNION ALL
      SELECT
        cs.id_usuario,
        cs.actualizada_en AS ts,
        'rimec-web(carrito)'::text AS app
      FROM carrito_sesion cs
      WHERE cs.actualizada_en IS NOT NULL
    )
    SELECT
      e.id_usuario,
      ((e.ts AT TIME ZONE 'America/Asuncion')::date - bounds.lun) AS dia_idx,
      MIN(e.ts)::text AS primera,
      MAX(e.ts)::text AS ultima,
      string_agg(DISTINCT e.app, ',') AS apps
    FROM eventos e
    CROSS JOIN bounds
    WHERE e.ts IS NOT NULL
      AND (e.ts AT TIME ZONE 'America/Asuncion')::date
        BETWEEN bounds.lun AND bounds.lun + 4
    GROUP BY e.id_usuario, ((e.ts AT TIME ZONE 'America/Asuncion')::date - bounds.lun)
  `)

  const byUserDay = new Map<string, { primera: string; ultima: string; apps: string[] }>()
  for (const r of diaRows) {
    const idx = Number(r.dia_idx)
    if (idx < 0 || idx > 4) continue
    byUserDay.set(`${r.id_usuario}:${idx}`, {
      primera: r.primera,
      ultima: r.ultima,
      apps: (r.apps || '').split(',').filter(Boolean),
    })
  }

  const hoyIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Asuncion' })

  const map = new Map<string, MonitoreoUsuarioRow[]>()
  for (const r of users) {
    const ventaHoras = horasDesde(r.venta_desde)
    const dias: DiaCelda[] = semana.labels.map((lab, idx) => {
      const hit = byUserDay.get(`${r.id_usuario}:${idx}`)
      const esHoy = lab.fecha === hoyIso
      const online = Boolean(esHoy && r.online_ahora)
      let texto = ''
      if (hit) {
        const viaCarrito = hit.apps.some((a) => a.includes('carrito'))
        texto = viaCarrito
          ? `x · activo ${fmtHoraAsu(hit.primera)}`
          : `x · sesión ${fmtHoraAsu(hit.primera)}`
        if (online) texto = `● online · ${texto.replace(/^x · /, '')}`
        if (hit.apps.length) texto += ` · ${hit.apps.join('+')}`
      }
      if (esHoy && r.venta_activa) {
        const v = `venta activa${ventaHoras != null ? ` ${ventaHoras} h` : ''}${
          r.items_carrito ? ` · ${r.items_carrito} ref` : ''
        }${r.venta_desde ? ` ${fmtHoraAsu(r.venta_desde)}` : ''}`
        texto = texto ? `${texto} · ${v}` : v
      }
      if (!texto && esHoy && !hit) {
        texto = '—'
      }
      return {
        clave: lab.clave,
        label: lab.label,
        fecha: lab.fecha,
        trabajo: Boolean(hit),
        online,
        texto,
        apps: hit?.apps ?? [],
      }
    })

    const row: MonitoreoUsuarioRow = {
      ...r,
      items_carrito: Number(r.items_carrito) || 0,
      venta_horas: ventaHoras,
      dias,
    }
    const key = grupoKey(row)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }

  const order = ['DIOS', 'ADMIN', 'BAZZAR', 'VENDEDOR', 'CONFEC', 'CAJA']
  const keys = [
    ...order.filter((k) => map.has(k)),
    ...[...map.keys()].filter((k) => !order.includes(k)).sort(),
  ]

  const grupos = keys.map((key) => {
    const all = map.get(key) ?? []
    const meta = metaGrupo(key)
    return {
      key,
      titulo: meta.titulo,
      subtitulo: meta.subtitulo,
      usuarios: all.filter((u) => !u.bloqueado),
      bloqueados: all.filter((u) => u.bloqueado),
    }
  })

  return { grupos, semana }
}
