/**
 * Cómo se llama este dispositivo en los textos («Esta lista aún no está en este iPhone.», diseño
 * 10). Por el navegador: el iPad moderno se presenta como Mac, pero es táctil.
 */
export function thisDevice(): string {
  const agent = navigator.userAgent
  if (/iPhone|iPod/.test(agent)) return 'iPhone'
  if (agent.includes('iPad') || (agent.includes('Macintosh') && navigator.maxTouchPoints > 1)) {
    return 'iPad'
  }
  if (/Android|Mobile/.test(agent)) return 'móvil'
  return 'ordenador'
}

/**
 * En qué tipo de aparato está la app (4.2): lo que cambia es cómo se suscribe uno al Calendario y
 * cómo se instala. `apple` es el iPhone, el iPad y el Mac, con cualquier navegador: el sistema abre
 * `webcal://` en su Calendario. `android`, Android. `other`, el resto (Windows, Linux…).
 */
export type DevicePlatform = 'apple' | 'android' | 'other'

export function devicePlatform(userAgent: string, maxTouchPoints: number): DevicePlatform {
  // El iPad se hace pasar por Mac: sigue siendo Apple.
  if (/iPhone|iPad|iPod|Macintosh/.test(userAgent)) return 'apple'
  if (userAgent.includes('Android')) return 'android'
  if (userAgent.includes('Mac OS X') && maxTouchPoints > 1) return 'apple'
  return 'other'
}

/** La de este navegador. */
export function currentPlatform(): DevicePlatform {
  return devicePlatform(navigator.userAgent, navigator.maxTouchPoints)
}

/**
 * La tecla de los atajos tal como se escribe (diseño 23, E1): ⌘ en Apple y Ctrl en lo demás
 * («⌘K» y «Ctrl K»). Los atajos aceptan las dos en cualquier sitio.
 */
export function shortcutKey(platform: DevicePlatform = currentPlatform()): '⌘' | 'Ctrl' {
  return platform === 'apple' ? '⌘' : 'Ctrl'
}

/**
 * El evento con el que Chrome, Edge y los navegadores de Android ofrecen instalar la app
 * (`beforeinstallprompt`). No está en los tipos de TypeScript: no es estándar.
 */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
