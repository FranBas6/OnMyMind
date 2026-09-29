import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { signInWithGoogle, type GoogleSignInOptions } from '../api'
import { authErrorMessage, GOOGLE_FAILED_MESSAGE } from '../errors'

interface UseGoogleSignInOptions extends GoogleSignInOptions {
  /** Se llegó al acceso desde `/auth/callback` sin sesión (`?error=google`). */
  returnedWithError: boolean
}

/**
 * «Continuar con Google» (diseño 11): el estado del botón y el error que el formulario pinta en
 * su línea de siempre, encima del botón principal.
 */
export function useGoogleSignIn({ redirect, mode, returnedWithError }: UseGoogleSignInOptions) {
  const mutation = useMutation({ mutationFn: signInWithGoogle })
  const [showReturnError, setShowReturnError] = useState(returnedWithError)
  const { reset } = mutation

  // Tras resolverse, el navegador ya se está yendo a Google: el botón sigue en «Abriendo Google…».
  // Si se vuelve con «atrás», la página sale entera de la caché (bfcache) con ese estado: se limpia.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [reset])

  let error: string | undefined
  if (mutation.error) error = authErrorMessage(mutation.error)
  else if (showReturnError) error = GOOGLE_FAILED_MESSAGE

  return {
    opening: mutation.isPending || mutation.isSuccess,
    error,
    start: () => {
      setShowReturnError(false)
      mutation.mutate({ redirect, mode })
    },
    /** Otro intento (email y contraseña) se lleva el error de Google. */
    dismiss: () => {
      setShowReturnError(false)
      reset()
    },
  }
}
