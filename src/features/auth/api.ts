import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase/client'

import { AuthFailure, authErrorMessage, EMAIL_TAKEN_MESSAGE, OFFLINE_MESSAGE } from './errors'
import type { AuthMode, SignInValues, SignUpValues } from './schemas'

export async function signInWithPassword({ email, password }: SignInValues): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
}

export interface SignUpResult {
  /**
   * Con *Confirm email* activo (1.17), Supabase crea la cuenta sin sesión y manda el correo de
   * confirmación, que lleva también el código: la app pasa a «Revisa tu email».
   */
  needsCode: boolean
}

/**
 * Crea la cuenta. Sin nombre (diseño Acceso): `handle_new_user` usa la parte del email antes de
 * la @. Si el proyecto no pide confirmar el email, Supabase devuelve ya la sesión.
 */
export async function signUp({ email, password }: SignUpValues): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
  // Con el email ya registrado y confirmado, Supabase no lo dice (para no revelar cuentas):
  // devuelve un usuario sin identidades y no manda nada. Se trata como «ya hay una cuenta».
  if (data.user?.identities?.length === 0) {
    throw new AuthFailure(EMAIL_TAKEN_MESSAGE)
  }
  return { needsCode: !data.session }
}

/**
 * Pide un código de seis dígitos por email (1.17). Si el email no tiene cuenta, Supabase la crea
 * y la confirma al validar el código: el mismo camino sirve para entrar y para crear cuenta.
 */
export async function requestEmailCode(email: string): Promise<void> {
  if (!navigator.onLine) throw new AuthFailure(OFFLINE_MESSAGE)
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
}

/**
 * Canjea el código por la sesión, dentro de la app (también la instalada en el iPhone, donde un
 * enlace del correo se abriría en Safari). `type: 'email'` vale para el código de entrar y para el
 * del correo de confirmación. Lanza el error de Supabase tal cual: `codeErrorKind` lo interpreta.
 */
export async function verifyEmailCode({ email, token }: { email: string; token: string }) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export interface GoogleSignInOptions {
  /** Ruta a la que volver tras entrar (el `?redirect=` del acceso). */
  redirect?: string | undefined
  /** Desde qué variante se salió, para volver a ella si Google no deja entrar. */
  mode?: AuthMode | undefined
}

/**
 * Sale a Google. Google devuelve a Supabase (`/auth/v1/callback`), que vuelve a
 * `/auth/callback` con un código; supabase-js lo canjea al arrancar. La promesa se resuelve justo
 * antes de que el navegador deje la página. Sin conexión no se sale: se avisa aquí.
 */
export async function signInWithGoogle({ redirect, mode }: GoogleSignInOptions): Promise<void> {
  if (!navigator.onLine) throw new AuthFailure(OFFLINE_MESSAGE)

  const callback = new URL('/auth/callback', window.location.origin)
  if (redirect) callback.searchParams.set('redirect', redirect)
  if (mode) callback.searchParams.set('mode', mode)

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.href,
      // Con varias cuentas de Google en el navegador, deja elegir en vez de entrar con la última.
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
}

/**
 * Cierra la sesión solo en este dispositivo. El `scope` por defecto de Supabase es `global`
 * y revocaría también la sesión del resto de dispositivos (salir en el ordenador te echaría
 * del iPhone).
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
}

/** Cambia la contraseña de la cuenta con la sesión abierta (Perfil, 1.13). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
}

/** Sesión guardada en este navegador (renueva el access token si ha caducado), o `null`. */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Se suscribe a los cambios de sesión (entrar, salir, renovar, también desde otra pestaña).
 * Llama a `callback` enseguida con la sesión actual. Devuelve la función para desuscribirse.
 */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => {
    data.subscription.unsubscribe()
  }
}
