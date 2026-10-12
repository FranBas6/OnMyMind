import { fromBase64, randomBytes, toBase64 } from './vault'

/**
 * La llave de este aparato (5.6, ADR-013): una llave de acceso (WebAuthn) con la extensión PRF,
 * que da 32 bytes que solo salen con Face ID, la huella, Touch ID o Windows Hello. Con ellos se
 * cifra la clave de la caja. No sirve para entrar en la cuenta: nadie comprueba su firma, solo
 * se usa lo que da PRF, y en ningún momento sale del aparato.
 */

/** Por qué no ha salido: cancelada o Face ID que no reconoce, o un aparato sin PRF. */
export type PasskeyProblem = 'cancelled' | 'unsupported' | 'failed'

export class PasskeyFailure extends Error {
  readonly problem: PasskeyProblem

  constructor(problem: PasskeyProblem, options?: ErrorOptions) {
    super(`Llave de acceso: ${problem}`, options)
    this.name = 'PasskeyFailure'
    this.problem = problem
  }
}

/** Cómo se llama el desbloqueo en este aparato, para los textos (diseño 26, C1, C4 y D1–D2). */
export interface DeviceUnlock {
  /** Al principio de una frase: «Face ID en este iPhone», «Huella en este móvil». */
  title: string
  /** Dentro de una frase: «desbloquear con Face ID», «con la huella». */
  noun: string
  /** El aparato: «iPhone», «Mac», «móvil», «ordenador». */
  device: string
}

/** El de este navegador, por el aparato: Face ID en el iPhone, Touch ID en el Mac… */
export function deviceUnlock(userAgent: string, maxTouchPoints: number): DeviceUnlock {
  if (/iPhone|iPod/.test(userAgent)) return { title: 'Face ID', noun: 'Face ID', device: 'iPhone' }
  if (userAgent.includes('iPad') || (userAgent.includes('Macintosh') && maxTouchPoints > 1)) {
    return { title: 'Face ID', noun: 'Face ID', device: 'iPad' }
  }
  if (userAgent.includes('Macintosh')) return { title: 'Touch ID', noun: 'Touch ID', device: 'Mac' }
  if (userAgent.includes('Android')) return { title: 'Huella', noun: 'la huella', device: 'móvil' }
  if (userAgent.includes('Windows')) {
    return { title: 'Windows Hello', noun: 'Windows Hello', device: 'ordenador' }
  }
  return { title: 'Llave de acceso', noun: 'la llave de acceso', device: 'ordenador' }
}

export function currentDeviceUnlock(): DeviceUnlock {
  return deviceUnlock(navigator.userAgent, navigator.maxTouchPoints)
}

/** Si el aparato tiene Face ID, la huella, Touch ID o Windows Hello para las llaves de acceso. */
export async function canUsePasskeys(): Promise<boolean> {
  if (typeof PublicKeyCredential === 'undefined') return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

const toBase64Url = (bytes: Uint8Array) =>
  toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replaceAll('-', '+').replaceAll('_', '/')
  return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4))
}

/** El id de usuario de la llave: los 16 bytes del uuid de la cuenta (una llave por cuenta). */
function userHandle(userId: string): Uint8Array<ArrayBuffer> {
  const hex = userId.replaceAll('-', '')
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function toFailure(error: unknown): PasskeyFailure {
  if (error instanceof PasskeyFailure) return error
  // Cancelada, Face ID que no reconoce o el tiempo agotado: el navegador no distingue.
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return new PasskeyFailure('cancelled', { cause: error })
  }
  if (error instanceof DOMException && error.name === 'NotSupportedError') {
    return new PasskeyFailure('unsupported', { cause: error })
  }
  return new PasskeyFailure('failed', { cause: error })
}

function prfOutput(credential: PublicKeyCredential): Uint8Array<ArrayBuffer> | null {
  const first = credential.getClientExtensionResults().prf?.results?.first
  if (!first) return null
  const bytes =
    first instanceof ArrayBuffer
      ? new Uint8Array(first)
      : new Uint8Array(first.buffer, first.byteOffset, first.byteLength)
  // Una copia propia: lo que da el navegador puede reutilizar su memoria.
  return new Uint8Array(bytes)
}

/** Lo que da la llave de este aparato para `prfSalt` (pide Face ID). */
export async function evaluatePasskey(
  credentialId: string,
  prfSalt: string,
): Promise<Uint8Array<ArrayBuffer>> {
  let credential: Credential | null
  try {
    credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: fromBase64(prfSalt) } } },
      },
    })
  } catch (error) {
    throw toFailure(error)
  }
  if (!(credential instanceof PublicKeyCredential)) throw new PasskeyFailure('failed')
  const output = prfOutput(credential)
  if (!output) throw new PasskeyFailure('unsupported')
  return output
}

/**
 * Crea la llave de este aparato y devuelve su id y lo que da para `prfSalt`. Algunos navegadores
 * lo dan ya al crearla; los demás, al usarla: entonces Face ID se pide dos veces. Sin PRF, la
 * llave queda creada pero no sirve: lo dice `unsupported`.
 */
export async function registerPasskey({
  userId,
  email,
  prfSalt,
}: {
  userId: string
  email: string
  prfSalt: string
}): Promise<{ credentialId: string; output: Uint8Array<ArrayBuffer> }> {
  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'OnMyMind' },
        user: { id: userHandle(userId), name: email, displayName: 'Clave privada de OnMyMind' },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'required',
        },
        timeout: 60_000,
        attestation: 'none',
        extensions: { prf: { eval: { first: fromBase64(prfSalt) } } },
      },
    })
  } catch (error) {
    throw toFailure(error)
  }
  if (!(credential instanceof PublicKeyCredential)) throw new PasskeyFailure('failed')
  const credentialId = toBase64Url(new Uint8Array(credential.rawId))
  const output = prfOutput(credential)
  if (output) return { credentialId, output }
  // Sin `enabled` no se sabe: se prueba a usarla, que dice `unsupported` si no da nada.
  if (credential.getClientExtensionResults().prf?.enabled === false) {
    throw new PasskeyFailure('unsupported')
  }
  return { credentialId, output: await evaluatePasskey(credentialId, prfSalt) }
}
