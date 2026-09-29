import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { z } from 'zod'

import type { AuthMode } from './schemas'

/** Dígitos del código (Supabase: *Email OTP Length*, 6 en local y en la nube). */
export const CODE_LENGTH = 6
/** Espera entre dos envíos al mismo email: el mínimo que impone Supabase (`max_frequency`). */
export const RESEND_AFTER_SECONDS = 60
/** Vida del código (Supabase: *Email OTP Expiration*, `otp_expiry`). */
export const CODE_EXPIRY_SECONDS = 3600
/** Bloqueo tras demasiados intentos: Supabase admite 30 comprobaciones cada 5 minutos por IP. */
export const LOCKOUT_SECONDS = 300

export const WRONG_CODE_MESSAGE = 'Ese código no es. Revísalo o pide otro.'
export const EXPIRED_CODE_MESSAGE = 'Ese código ya no vale. Te hemos enviado otro.'
export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Demasiados intentos. Espera 5 minutos o entra con tu contraseña.'

export type CodeErrorKind = 'wrong' | 'expired' | 'tooMany' | 'offline' | 'other'

/**
 * Qué ha pasado al comprobar un código. Supabase responde `otp_expired` tanto si el código está
 * mal como si caducó, así que se decide por el reloj: si ya pasó su vida desde el envío, caducó.
 */
export function codeErrorKind(error: unknown, sentAt: number, now: number): CodeErrorKind {
  if (isAuthRetryableFetchError(error)) return 'offline'
  if (!isAuthError(error)) return 'other'
  if (error.code === 'over_request_rate_limit' || error.status === 429) return 'tooMany'
  if (error.code === 'otp_expired') {
    return now - sentAt >= CODE_EXPIRY_SECONDS * 1000 ? 'expired' : 'wrong'
  }
  return 'other'
}

/** Segundos que faltan hasta `until` (nunca negativos, redondeando hacia arriba). */
export function secondsUntil(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000))
}

/** «Volver a enviar en 45 s» hasta el minuto; por encima, en minutos («en 5 min»). */
export function resendCountdownLabel(seconds: number): string {
  if (seconds > 60) return `Volver a enviar en ${String(Math.ceil(seconds / 60))} min`
  return `Volver a enviar en ${String(seconds)} s`
}

/**
 * Código pedido y aún sin escribir. Se guarda para que, si iOS cierra la app mientras miras el
 * correo, al volver sigas en «Revisa tu email» y no tengas que pedir otro.
 */
export interface PendingCode {
  email: string
  sentAt: number
  mode?: AuthMode | undefined
  /** El código es el del correo de confirmar la cuenta recién creada con contraseña. */
  confirming?: boolean | undefined
}

const PENDING_KEY = 'omm.emailCode'

const pendingSchema = z.object({
  email: z.string(),
  sentAt: z.number(),
  mode: z.enum(['signup']).optional(),
  confirming: z.boolean().optional(),
})

export function savePendingCode(pending: PendingCode): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // Sin almacenamiento (modo privado): se pierde al recargar, sin más.
  }
}

/** El código pendiente si aún vale; si caducó o no hay, `null` (y se limpia). */
export function loadPendingCode(now: number): PendingCode | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = pendingSchema.safeParse(JSON.parse(raw))
    if (parsed.success && now - parsed.data.sentAt < CODE_EXPIRY_SECONDS * 1000) {
      return parsed.data
    }
    localStorage.removeItem(PENDING_KEY)
    return null
  } catch {
    return null
  }
}

export function clearPendingCode(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // Nada que limpiar.
  }
}
