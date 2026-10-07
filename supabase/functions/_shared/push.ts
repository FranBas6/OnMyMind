// Lo puro del push, compartido por `send-reminders` (2.7) y `refresh-prices` (3.8): el mensaje que
// entiende el service worker, la clave pública y quién envía (VAPID, RFC 8292), y qué respuesta del
// servicio de push dice que una suscripción ya no existe. El envío, con Deno, en `webpush.ts`.

/** El mensaje de un push: el contrato con el service worker (`src/sw/push.ts`). */
export interface PushMessage {
  title: string
  body?: string
  url?: string
  tag?: string
}

/** La clave pública VAPID, la misma que `src/features/reminders/vapid.ts` (lo comprueba un test). */
export const VAPID_PUBLIC_KEY =
  'BGA_Yb5OLyw9z6kxTSMH_RySTMf2-9b6U344fXU5wzugTNhV2Cp-5QC1eXU4h6a4RjFbRRC3ysZDBojmg5OuT2Q'

/** Quién envía, para el servicio de push (RFC 8292): la web de la app. */
export const VAPID_SUBJECT = 'https://onmymind.pages.dev'

/** Si el servicio de push dice que la suscripción ya no existe: se borra. */
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/**
 * El par VAPID en JWK, que es como lo importa `@negrel/webpush`. Las claves se generaron en la 2.6
 * en el formato de `web-push`: la pública, el punto P-256 sin comprimir (65 bytes: 0x04, x, y); la
 * privada, el escalar `d` (32 bytes); las dos en base64url.
 */
export function vapidJwk(
  publicKey: string,
  privateKey: string,
): { publicKey: JsonWebKey; privateKey: JsonWebKey } {
  const point = fromBase64Url(publicKey)
  if (point.length !== 65 || point[0] !== 4) throw new Error('VAPID: la clave pública no es P-256')
  if (fromBase64Url(privateKey).length !== 32)
    throw new Error('VAPID: la clave privada no es P-256')
  const x = base64Url(point.slice(1, 33))
  const y = base64Url(point.slice(33, 65))
  return {
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d: privateKey, ext: false },
  }
}
