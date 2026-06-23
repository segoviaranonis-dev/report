/** Bump invalida todas las sesiones Report (protocolo governance). */
export const REPORT_SESSION_VERSION = 3

/** Reversiones holding — debe coincidir con NEXUS_HOLDING_REVERSAL en servidor. */
export function holdingReversalEnabled(): boolean {
  const v = (process.env.NEXUS_HOLDING_REVERSAL || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}
