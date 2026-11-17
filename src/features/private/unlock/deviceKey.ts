/**
 * Qué llave de acceso es la de este aparato (5.6). Lo sabe solo el navegador: la base guarda las
 * llaves de todos tus aparatos, y la de este es la que se creó aquí. Se guarda en `localStorage`
 * su id, que no es secreto (sin Face ID no da nada). También si aquí PRF no funcionó, para decir
 * «Solo con la clave en este ordenador» sin volver a intentarlo.
 */

const DEVICE_KEY = 'onmymind-private-device-key'
const NO_PRF = 'onmymind-private-no-prf'

export interface DeviceKeyMarker {
  userId: string
  /** `private_vault_keys.id`. */
  keyRowId: string
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento (navegación privada): se vuelve a preguntar la próxima vez.
  }
}

/** La llave de este aparato para esta cuenta, si la hay. */
export function readDeviceKey(userId: string): DeviceKeyMarker | null {
  const text = read(DEVICE_KEY)
  if (!text) return null
  try {
    const value: unknown = JSON.parse(text)
    if (
      typeof value === 'object' &&
      value !== null &&
      'userId' in value &&
      'keyRowId' in value &&
      value.userId === userId &&
      typeof value.keyRowId === 'string'
    ) {
      return { userId, keyRowId: value.keyRowId }
    }
  } catch {
    // Mal guardado: como si no hubiera.
  }
  return null
}

export function saveDeviceKey(marker: DeviceKeyMarker): void {
  write(DEVICE_KEY, JSON.stringify(marker))
}

export function clearDeviceKey(): void {
  write(DEVICE_KEY, null)
}

/** Si aquí la llave de acceso no da lo que hace falta (sin PRF). */
export function prfUnsupportedHere(): boolean {
  return read(NO_PRF) === '1'
}

export function markPrfUnsupported(): void {
  write(NO_PRF, '1')
}
