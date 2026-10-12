import type { DeviceUnlock } from './passkey'
import { KEY_MIN_LENGTH } from './vault'

/** Los textos de la clave privada (diseño 26). */

export const KEY_HINT = `Mínimo ${KEY_MIN_LENGTH} caracteres. Una frase que recuerdes sirve.`
export const KEY_MISMATCH = 'No coinciden. Escríbela otra vez.'
export const WRONG_KEY = 'Esa no es la clave. Prueba otra vez.'
export const WRONG_CURRENT_KEY = 'Esa no es la clave de ahora. Prueba otra vez.'
export const NEEDS_CONNECTION = 'Hace falta conexión. Prueba otra vez cuando vuelva.'
export const SOMETHING_FAILED = 'No ha salido. Prueba otra vez en un momento.'

/** Debajo de las filas de Perfil, sin clave aún (C1). */
export const ONE_KEY_NOTE = 'Una sola clave para tus notas protegidas y tus listas ocultas.'
/** Debajo de las filas de Perfil, con la clave (C1b). */
export const AUTO_LOCK_NOTE = 'Se bloquea solo a los 5 minutos y al salir de la app.'

/** Para las contraseñas de verdad (C2 y D3): la app del sistema donde la hay. */
export function passwordsApp(unlock: DeviceUnlock): string {
  if (unlock.device === 'iPhone' || unlock.device === 'iPad' || unlock.device === 'Mac') {
    return `la app Contraseñas del ${unlock.device}`
  }
  return 'un gestor de contraseñas'
}

/** «Face ID en este iPhone», «Touch ID en este Mac», «Huella en este móvil». */
export function deviceKeyLabel(unlock: DeviceUnlock): string {
  return `${unlock.title} en este ${unlock.device}`
}

/** «Este navegador no permite desbloquear con Windows Hello. Aquí se desbloquea con la clave.» (D2). */
export function unsupportedNote(unlock: DeviceUnlock): string {
  return `Este navegador no permite desbloquear con ${unlock.noun}. Aquí se desbloquea con la clave.`
}

/** «Usar Face ID», «Usar la huella». */
export function deviceActionLabel(unlock: DeviceUnlock): string {
  return `Usar ${unlock.noun}`
}

/** «Probar con Face ID», «Probar con la huella». */
export function tryDeviceLabel(unlock: DeviceUnlock): string {
  return `Probar con ${unlock.noun}`
}
