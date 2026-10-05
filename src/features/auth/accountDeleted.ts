/**
 * El aviso del acceso tras borrar la cuenta (2.8, decisión de Fran): «Tu cuenta y todo lo que tenía
 * se han borrado.». Se guarda en `sessionStorage` (solo esta pestaña, y se olvida al cerrarla) en
 * vez de en la URL, porque al acabar la sesión la guarda de las rutas privadas también lleva a
 * `/login` y la URL podría ser la suya. Se enseña una vez.
 */
const KEY = 'omm.accountDeleted'

export const ACCOUNT_DELETED_MESSAGE = 'Tu cuenta y todo lo que tenía se han borrado.'

export function markAccountDeleted(): void {
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // Sin almacenamiento: se borra igual, sin el aviso.
  }
}

export function wasAccountDeleted(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function forgetAccountDeleted(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Igual que arriba.
  }
}
