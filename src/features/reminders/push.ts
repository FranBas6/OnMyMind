import { savePushSubscription, deletePushSubscription } from './api'
import { VAPID_PUBLIC_KEY } from './vapid'

/**
 * Si este dispositivo recibe avisos (02 §Notificaciones push, 04 §PWA):
 * - `needs-install`: un iPhone o iPad fuera de la app instalada (iOS solo da push instalada).
 * - `unsupported`: sin service worker o sin Web Push (también en `pnpm dev`, que no lo registra).
 * - `denied`: el sistema dijo que no; solo se arregla en sus ajustes.
 * - `off`: se pueden activar. `on`: activados, con la suscripción guardada.
 */
export type PushState = 'needs-install' | 'unsupported' | 'denied' | 'off' | 'on'

export interface PushEnvironment {
  ios: boolean
  standalone: boolean
  supported: boolean
  permission: NotificationPermission | null
  subscribed: boolean
}

export function derivePushState(env: PushEnvironment): PushState {
  if (env.ios && !env.standalone) return 'needs-install'
  if (!env.supported || env.permission === null) return 'unsupported'
  if (env.permission === 'denied') return 'denied'
  return env.permission === 'granted' && env.subscribed ? 'on' : 'off'
}

/** Un iPhone o iPad, con cualquier navegador (en iOS todos son Safari por dentro). */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)
  )
}

function isStandaloneDisplay(): boolean {
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return legacy || window.matchMedia('(display-mode: standalone)').matches
}

/** El registro del service worker, si lo hay (en `pnpm dev` no). */
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return navigator.serviceWorker.getRegistration()
}

/** La clave pública en el formato que pide `PushManager.subscribe` (base64url → bytes). */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function keysOf(subscription: PushSubscription) {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) throw new Error('La suscripción no trae sus claves.')
  return { endpoint: json.endpoint, p256dh, auth }
}

/**
 * Cómo está este dispositivo. Si los avisos están activados, vuelve a guardar la suscripción (es
 * idempotente): así la cuenta la tiene aunque el navegador la haya renovado o se haya entrado con
 * otra cuenta en él.
 */
export async function readPushState(): Promise<PushState> {
  const reg = await registration()
  const supported = reg !== undefined && 'PushManager' in window && 'Notification' in window
  const subscription = supported ? await reg.pushManager.getSubscription() : null
  const state = derivePushState({
    ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandaloneDisplay(),
    supported,
    permission: 'Notification' in window ? Notification.permission : null,
    subscribed: subscription !== null,
  })
  if (state === 'on' && subscription) {
    await savePushSubscription(keysOf(subscription), navigator.userAgent).catch(() => undefined)
  }
  return state
}

/**
 * Pide el permiso (el diálogo del sistema). Hay que llamarlo en el mismo toque, sin esperar a nada
 * antes: Safari solo lo enseña así. Por eso va aparte de `enablePush`, que recibe su promesa.
 */
export function askPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied')
  return Notification.requestPermission()
}

/**
 * Activa los avisos en este dispositivo con el permiso pedido (`askPermission`): se suscribe con la
 * clave VAPID y guarda la suscripción. Devuelve cómo queda.
 */
export async function enablePush(asked: Promise<NotificationPermission>): Promise<PushState> {
  const permission = await asked
  const reg = await registration()
  if (!reg || !('PushManager' in window)) return 'unsupported'
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
    }))
  await savePushSubscription(keysOf(subscription), navigator.userAgent)
  return 'on'
}

/** Los desactiva en este dispositivo: se borra la suscripción del navegador y de la cuenta. */
export async function disablePush(): Promise<PushState> {
  const reg = await registration()
  const subscription = await reg?.pushManager.getSubscription()
  if (subscription) {
    await deletePushSubscription(subscription.endpoint)
    await subscription.unsubscribe()
  }
  return 'off'
}

const PROMPT_KEY = 'omm:push-prompt-dismissed'

/**
 * Si en este dispositivo ya se dijo «Ahora no» a activar los avisos: entonces no se vuelve a
 * preguntar sola al poner un aviso, y queda el «Activar» bajo la fila (diseño 18, A4). El
 * almacenamiento puede fallar (Safari privado): entonces se pregunta.
 */
export function promptDismissed(): boolean {
  try {
    return window.localStorage.getItem(PROMPT_KEY) !== null
  } catch {
    return false
  }
}

export function dismissPrompt(): void {
  try {
    window.localStorage.setItem(PROMPT_KEY, new Date().toISOString())
  } catch {
    // Sin almacenamiento, se volverá a preguntar: no pasa nada.
  }
}
