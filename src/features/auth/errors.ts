import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

/** Error del acceso con el mensaje ya traducido para mostrarlo tal cual en la interfaz. */
export class AuthFailure extends Error {
  override name = 'AuthFailure'
}

/** Cuenta creada pero sin sesión: pasa si el proyecto exige confirmar el email. */
export const UNCONFIRMED_EMAIL_MESSAGE = 'Te falta confirmar el email. Revisa tu correo.'

/** Mensajes en la voz de la marca para los códigos de error de Supabase Auth que pueden salir en el acceso. */
const MESSAGES_BY_CODE: Record<string, string> = {
  // Supabase no distingue email inexistente de contraseña incorrecta, a propósito.
  invalid_credentials: 'Ese email o esa contraseña no son. Prueba otra vez.',
  user_already_exists: 'Ya hay una cuenta con ese email. Entra con ella.',
  email_exists: 'Ya hay una cuenta con ese email. Entra con ella.',
  weak_password: 'Esa contraseña es fácil de adivinar. Prueba con otra más larga.',
  email_address_invalid: 'Ese email no parece válido.',
  email_not_confirmed: UNCONFIRMED_EMAIL_MESSAGE,
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera un momento y prueba otra vez.',
  over_email_send_rate_limit: 'Demasiados intentos seguidos. Espera un momento y prueba otra vez.',
  signup_disabled: 'Ahora mismo no se pueden crear cuentas.',
  same_password: 'Es la misma que ya tienes. Elige otra.',
  reauthentication_needed: 'Por seguridad, sal y vuelve a entrar antes de cambiarla.',
}

const OFFLINE_MESSAGE = 'No hay conexión. Prueba otra vez cuando vuelva.'
const FALLBACK_MESSAGE = 'Algo ha fallado. Prueba otra vez.'

/** Traduce cualquier error del acceso a una frase para la interfaz, sin jerga técnica. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthFailure) return error.message
  if (isAuthRetryableFetchError(error)) return OFFLINE_MESSAGE
  if (isAuthError(error) && error.code) return MESSAGES_BY_CODE[error.code] ?? FALLBACK_MESSAGE
  return FALLBACK_MESSAGE
}
