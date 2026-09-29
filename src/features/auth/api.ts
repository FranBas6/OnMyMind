import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase/client'

import { AuthFailure, authErrorMessage, OFFLINE_MESSAGE, UNCONFIRMED_EMAIL_MESSAGE } from './errors'
import type { AuthMode, SignInValues, SignUpValues } from './schemas'

export async function signInWithPassword({ email, password }: SignInValues): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
}

/**
 * Crea la cuenta y entra. Sin nombre (diseño Acceso): `handle_new_user` usa la parte del email
 * antes de la @. Con la confirmación de email desactivada, Supabase devuelve ya la sesión.
 */
export async function signUp({ email, password }: SignUpValues): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new AuthFailure(authErrorMessage(error), { cause: error })
  if (!data.session) throw new AuthFailure(UNCONFIRMED_EMAIL_MESSAGE)
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
