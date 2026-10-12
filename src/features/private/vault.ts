/**
 * Lo puro de la clave privada (5.6, ADR-013), con WebCrypto y sin nada de fuera.
 *
 * - **La clave de la caja** es al azar (AES-GCM de 256 bits). Es la que cifrará lo protegido
 *   (5.7). Nunca sale del aparato sin cifrar.
 * - **Con la clave privada** se deriva otra (PBKDF2-SHA256, 600 000 vueltas, sal al azar) que
 *   cifra la clave de la caja. Cambiar la clave privada solo vuelve a cifrarla.
 * - **Con una llave de acceso** (Face ID, la huella, Touch ID, Windows Hello), lo que da su
 *   extensión PRF pasa por HKDF y cifra la misma clave de la caja.
 * - **El comprobador** (SHA-256 de la clave de la caja con una etiqueta) dice que lo descifrado es
 *   la clave de verdad, también si alguien con la sesión abierta cambiara lo guardado.
 */

/** OWASP (2023) para PBKDF2-SHA256. En un iPhone tarda menos de un segundo. */
export const KDF_ITERATIONS = 600_000
/**
 * «Mínimo 4 caracteres. Una frase que recuerdes sirve.» El diseño 26 (C2) decía 6; Fran lo bajó a
 * 4 para quien use un PIN (2026-10-12). Lo que eso supone, en el ADR-013.
 */
export const KEY_MIN_LENGTH = 4

const SALT_BYTES = 16
const IV_BYTES = 12
const PRF_SALT_BYTES = 32
const CHECK_LABEL = 'onmymind · comprobador de la caja'
const PRF_INFO = 'onmymind · clave de la caja con una llave de acceso'

/** La clave de la caja cifrada: el vector de AES-GCM y lo cifrado, en base64. */
export interface WrappedKey {
  iv: string
  wrapped: string
}

/** Cifrada con la clave privada: además, la sal y las vueltas de PBKDF2. */
export interface PasswordWrap extends WrappedKey {
  salt: string
  iterations: number
}

const encoder = new TextEncoder()

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

/** Lo que se le pide a una llave de acceso (PRF), al azar, en base64. */
export function newPrfSalt(): string {
  return toBase64(randomBytes(PRF_SALT_BYTES))
}

/** Una clave de la caja nueva. Extraíble: se vuelve a cifrar al cambiar la clave o añadir una llave. */
export function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/** El comprobador de una clave de la caja, en base64. */
export async function keyCheck(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  const label = encoder.encode(CHECK_LABEL)
  const data = new Uint8Array(label.length + raw.length)
  data.set(label)
  data.set(raw, label.length)
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

/** Si lo descifrado es la clave de la caja de verdad. */
export async function matchesCheck(key: CryptoKey, check: string): Promise<boolean> {
  return (await keyCheck(key)) === check
}

/**
 * La clave que sale de la clave privada. Se normaliza (NFC) para que una tilde escrita en el iPhone
 * y en el Mac den lo mismo; no se quitan espacios: son parte de la frase.
 */
async function passwordKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

/** La clave que sale de una llave de acceso (lo que da PRF, 32 bytes), con HKDF-SHA256. */
async function prfKey(output: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', output, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(PRF_INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

async function wrapWith(vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<WrappedKey> {
  const iv = randomBytes(IV_BYTES)
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, wrappingKey, { name: 'AES-GCM', iv })
  return { iv: toBase64(iv), wrapped: toBase64(new Uint8Array(wrapped)) }
}

/** Descifra la clave de la caja; con otra clave, AES-GCM falla y da `null`. */
async function unwrapWith(wrap: WrappedKey, wrappingKey: CryptoKey): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      fromBase64(wrap.wrapped),
      wrappingKey,
      { name: 'AES-GCM', iv: fromBase64(wrap.iv) },
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt'],
    )
  } catch {
    return null
  }
}

/** Cifra la clave de la caja con la clave privada, con una sal nueva. */
export async function wrapWithPassword(
  vaultKey: CryptoKey,
  password: string,
  iterations: number = KDF_ITERATIONS,
): Promise<PasswordWrap> {
  const salt = randomBytes(SALT_BYTES)
  const wrap = await wrapWith(vaultKey, await passwordKey(password, salt, iterations))
  return { ...wrap, salt: toBase64(salt), iterations }
}

/** La clave de la caja con la clave privada, o `null` si no es esa. */
export async function unwrapWithPassword(
  wrap: PasswordWrap,
  password: string,
): Promise<CryptoKey | null> {
  return unwrapWith(wrap, await passwordKey(password, fromBase64(wrap.salt), wrap.iterations))
}

/** Cifra la clave de la caja con lo que da una llave de acceso. */
export async function wrapWithPrf(
  vaultKey: CryptoKey,
  output: Uint8Array<ArrayBuffer>,
): Promise<WrappedKey> {
  return wrapWith(vaultKey, await prfKey(output))
}

/** La clave de la caja con lo que da una llave de acceso, o `null` si no es la suya. */
export async function unwrapWithPrf(
  wrap: WrappedKey,
  output: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey | null> {
  return unwrapWith(wrap, await prfKey(output))
}

/**
 * Un texto cifrado con la clave de la caja (5.7): el de una nota protegida. AES-GCM con un vector
 * nuevo cada vez, así que cifrar lo mismo dos veces no da lo mismo.
 */
export interface SealedText {
  sealed: string
  iv: string
}

/** Cifra un texto con la clave de la caja. */
export async function sealText(key: CryptoKey, text: string): Promise<SealedText> {
  const iv = randomBytes(IV_BYTES)
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text))
  return { sealed: toBase64(new Uint8Array(sealed)), iv: toBase64(iv) }
}

/** Descifra un texto con la clave de la caja; con otra clave, o cambiado, `null`. */
export async function openText(key: CryptoKey, { sealed, iv }: SealedText): Promise<string | null> {
  try {
    const text = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(sealed),
    )
    return new TextDecoder().decode(text)
  } catch {
    return null
  }
}
