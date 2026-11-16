/**
 * Cuándo sale sola la hoja «Instalar en el iPhone» (diseño 10). Solo en Safari de iOS y sin la
 * app instalada. La primera vez sale sola; «Lo haré después» (o la ×) la trae de vuelta a los
 * siete días, una sola vez más; «No volver a mostrar» no la trae nunca. Desde Perfil · App se
 * abre siempre que quieras.
 */

const KEY = 'omm-install-hint'
export const INSTALL_HINT_AGAIN_MS = 7 * 24 * 60 * 60 * 1000

export interface InstallHintRecord {
  /** Cuántas veces ha salido sola. */
  shown: number
  /** Cuándo se cerró por última vez (ISO), o `null`. */
  dismissedAt: string | null
  never: boolean
}

const EMPTY: InstallHintRecord = { shown: 0, dismissedAt: null, never: false }

/** Safari de iOS o iPadOS (no Chrome, Firefox ni Edge de iOS, que instalan de otra forma). */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)
  return ios && userAgent.includes('Safari') && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)
}

/** Si esta pantalla es la app instalada (sin la barra de Safari). */
export function isStandalone(): boolean {
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return legacy || window.matchMedia('(display-mode: standalone)').matches
}

/** Si la hoja tiene que salir sola ahora. */
export function shouldAutoShow(record: InstallHintRecord, now: Date): boolean {
  if (record.never) return false
  if (record.shown === 0) return true
  if (record.shown >= 2 || !record.dismissedAt) return false
  return now.getTime() - new Date(record.dismissedAt).getTime() >= INSTALL_HINT_AGAIN_MS
}

export function readInstallHint(): InstallHintRecord {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<InstallHintRecord>
    return {
      shown: typeof parsed.shown === 'number' ? parsed.shown : 0,
      dismissedAt: typeof parsed.dismissedAt === 'string' ? parsed.dismissedAt : null,
      never: parsed.never === true,
    }
  } catch {
    return EMPTY
  }
}

export function writeInstallHint(record: InstallHintRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Sin almacenamiento (navegación privada): volverá a salir, sin más.
  }
}
