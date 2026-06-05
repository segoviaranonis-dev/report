/**
 * Validación de URLs de imágenes para prevenir SSRF attacks
 * Solo permite dominios whitelisteados y protocolo HTTPS
 *
 * SISTEMA DE CARGA GARANTIZADA:
 * - Detección de dispositivo (desktop/tablet/mobile)
 * - Timeouts adaptativos según dispositivo
 * - Reintentos con backoff exponencial (mínimo 3 intentos)
 * - Concurrencia adaptativa según capacidad del dispositivo
 * - Logging detallado de cada intento
 */

// Dominios permitidos para cargar imágenes
const ALLOWED_DOMAINS = [
  'supabase.co',      // Supabase Storage
  'supabase.in',      // Supabase Storage (alternativo)
]

// ─── TIPOS ───────────────────────────────────────────────────────────────────
export type DeviceType = 'desktop' | 'tablet' | 'mobile'

export interface FetchImageOptions {
  deviceType?: DeviceType
  maxRetries?: number
  onProgress?: (attempt: number, maxAttempts: number, url: string) => void
  fallbackUrls?: string[]
}

interface FetchAttemptResult {
  success: boolean
  response?: Response
  error?: string
  attempt: number
  elapsedMs: number
}

/**
 * Detecta el tipo de dispositivo basándose en características del navegador
 * Usado para ajustar timeouts y concurrencia de carga de imágenes
 *
 * @returns Tipo de dispositivo: 'desktop', 'tablet' o 'mobile'
 */
export function detectDeviceType(): DeviceType {
  // Verificar si estamos en Node.js (SSR)
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop' // Asumir desktop en SSR
  }

  const ua = navigator.userAgent.toLowerCase()
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const screenWidth = window.screen.width
  const screenHeight = window.screen.height
  const maxDimension = Math.max(screenWidth, screenHeight)

  // Detectar tablet
  if (isTouch && maxDimension >= 768 && maxDimension < 1366) {
    return 'tablet'
  }

  // Detectar móvil
  if (isTouch && maxDimension < 768) {
    return 'mobile'
  }

  // User agent patterns para tablets
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet'
  }

  // User agent patterns para móviles
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile'
  }

  return 'desktop'
}

/**
 * Obtiene el timeout base recomendado según el tipo de dispositivo
 *
 * @param deviceType - Tipo de dispositivo
 * @returns Timeout en milisegundos
 */
export function getDeviceTimeout(deviceType: DeviceType): number {
  switch (deviceType) {
    case 'desktop':
      return 5000  // 5 segundos
    case 'tablet':
      return 15000 // 15 segundos (mínimo según LEY técnica)
    case 'mobile':
      return 20000 // 20 segundos (mínimo según LEY técnica)
  }
}

/**
 * Obtiene el límite de concurrencia recomendado según el tipo de dispositivo
 *
 * @param deviceType - Tipo de dispositivo
 * @returns Número máximo de descargas paralelas
 */
export function getConcurrencyLimit(deviceType: DeviceType): number {
  switch (deviceType) {
    case 'desktop':
      return 10 // Hasta 10 imágenes en paralelo
    case 'tablet':
      return 3  // Máximo 3 imágenes en paralelo
    case 'mobile':
      return 2  // Máximo 2 imágenes en paralelo
  }
}

/**
 * Valida si una URL de imagen es segura para fetch
 *
 * @param url - URL de la imagen a validar
 * @returns true si la URL es segura, false en caso contrario
 *
 * @example
 * isValidImageUrl('https://abc.supabase.co/storage/v1/object/public/productos/img.png') // true
 * isValidImageUrl('http://localhost:5432/admin') // false (protocolo no seguro)
 * isValidImageUrl('https://evil.com/malware.jpg') // false (dominio no permitido)
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)

    // Solo HTTPS (no HTTP ni otros protocolos)
    if (parsed.protocol !== 'https:') {
      console.warn('[Security] Imagen rechazada - protocolo no seguro:', parsed.protocol)
      return false
    }

    // Verificar que el hostname termine en alguno de los dominios permitidos
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      console.warn('[Security] Imagen rechazada - dominio no permitido:', parsed.hostname)
      return false
    }

    return true
  } catch (error) {
    console.warn('[Security] Imagen rechazada - URL inválida:', url)
    return false
  }
}

/**
 * Intenta cargar una imagen con timeout
 * (función interna, usar safeFetchImageGarantizado para carga con reintentos)
 */
async function fetchImageAttempt(
  url: string,
  timeoutMs: number,
  attempt: number
): Promise<FetchAttemptResult> {
  const startTime = performance.now()

  if (!isValidImageUrl(url)) {
    return {
      success: false,
      error: 'URL no válida o dominio no permitido',
      attempt,
      elapsedMs: 0
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nexus-Core-Report-PDF-Generator/1.0',
      },
    })

    clearTimeout(timeoutId)
    const elapsedMs = Math.round(performance.now() - startTime)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        attempt,
        elapsedMs
      }
    }

    return {
      success: true,
      response,
      attempt,
      elapsedMs
    }
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startTime)

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: `Timeout después de ${timeoutMs}ms`,
        attempt,
        elapsedMs
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      attempt,
      elapsedMs
    }
  }
}

/**
 * CARGA GARANTIZADA de imagen con reintentos y backoff exponencial
 *
 * Implementa la LEY de Integridad Visual PDF:
 * - Timeouts adaptativos según dispositivo (desktop: 5s, tablet: 15s, mobile: 20s)
 * - Reintentos con backoff exponencial (intento 1: timeout × 1, intento 2: timeout × 1.5, intento 3: timeout × 2)
 * - Soporte para URLs fallback (thumbnails, CDN alternativo)
 * - Logging detallado de cada intento
 * - Callback de progreso para UI
 *
 * @param url - URL principal de la imagen
 * @param options - Opciones de carga
 * @returns Response exitoso o lanza error si fallan todos los intentos
 * @throws Error si no se pudo cargar la imagen después de todos los reintentos
 *
 * @example
 * const device = detectDeviceType()
 * const response = await safeFetchImageGarantizado(imageUrl, {
 *   deviceType: device,
 *   maxRetries: 3,
 *   onProgress: (attempt, max, url) => console.log(`Intento ${attempt}/${max}`),
 *   fallbackUrls: [thumbnailUrl]
 * })
 */
export async function safeFetchImageGarantizado(
  url: string,
  options: FetchImageOptions = {}
): Promise<Response> {
  const {
    deviceType = detectDeviceType(),
    maxRetries = 3,
    onProgress,
    fallbackUrls = []
  } = options

  const baseTimeout = getDeviceTimeout(deviceType)
  const allUrls = [url, ...fallbackUrls].filter(u => u && isValidImageUrl(u))

  if (allUrls.length === 0) {
    throw new Error('[PDF] No hay URLs válidas para cargar la imagen')
  }

  console.log(`[PDF] Iniciando carga garantizada - Dispositivo: ${deviceType}, Timeout base: ${baseTimeout}ms, URLs disponibles: ${allUrls.length}`)

  const errors: string[] = []

  // Intentar cada URL con reintentos
  for (let urlIndex = 0; urlIndex < allUrls.length; urlIndex++) {
    const currentUrl = allUrls[urlIndex]
    const urlLabel = urlIndex === 0 ? 'URL principal' : `Fallback ${urlIndex}`

    console.log(`[PDF] Probando ${urlLabel}: ${currentUrl}`)

    // Reintentos con backoff exponencial
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Calcular timeout con backoff: intento 1 = 1x, intento 2 = 1.5x, intento 3 = 2x
      const backoffMultiplier = 1 + ((attempt - 1) * 0.5)
      const timeout = Math.round(baseTimeout * backoffMultiplier)

      console.log(`[PDF]   Intento ${attempt}/${maxRetries} (timeout: ${timeout}ms)`)

      // Notificar progreso al callback
      if (onProgress) {
        onProgress(attempt, maxRetries, currentUrl)
      }

      const result = await fetchImageAttempt(currentUrl, timeout, attempt)

      if (result.success && result.response) {
        console.log(`[PDF]   ✓ Éxito en ${result.elapsedMs}ms`)
        return result.response
      }

      const errorMsg = `${urlLabel} intento ${attempt}/${maxRetries}: ${result.error} (${result.elapsedMs}ms)`
      console.warn(`[PDF]   ✗ ${errorMsg}`)
      errors.push(errorMsg)

      // Esperar antes del siguiente intento (excepto en el último)
      if (attempt < maxRetries) {
        const waitMs = 500 * attempt // 500ms, 1000ms, 1500ms
        await new Promise(resolve => setTimeout(resolve, waitMs))
      }
    }
  }

  // Si llegamos aquí, fallaron todos los intentos
  const totalAttempts = allUrls.length * maxRetries
  const errorDetail = errors.join('\n  - ')
  const errorMessage = `[PDF] ERROR CRÍTICO: No se pudo cargar imagen después de ${totalAttempts} intentos\n  - ${errorDetail}`

  console.error(errorMessage)
  throw new Error(errorMessage)
}

/**
 * Fetch seguro de imagen con timeout y validación (LEGACY - mantener compatibilidad)
 *
 * @deprecated Usar safeFetchImageGarantizado para carga con reintentos automáticos
 *
 * @param url - URL de la imagen
 * @param timeoutMs - Timeout en milisegundos (default: 5000)
 * @returns Response de fetch o null si falla
 */
export async function safeFetchImage(
  url: string,
  timeoutMs: number = 5000
): Promise<Response | null> {
  try {
    const response = await safeFetchImageGarantizado(url, {
      deviceType: 'desktop',
      maxRetries: 1,
      fallbackUrls: []
    })
    return response
  } catch {
    return null
  }
}
