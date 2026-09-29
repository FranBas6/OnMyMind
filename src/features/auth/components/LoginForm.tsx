import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'

import { authErrorMessage } from '../errors'
import { useSignIn } from '../hooks/useAuthMutations'
import { useGoogleSignIn } from '../hooks/useGoogleSignIn'
import { signInSchema } from '../schemas'
import { AuthField, FormError, PasswordField } from './AuthField'
import { GoogleButton, OrSeparator } from './GoogleButton'

interface LoginFormProps {
  onSuccess: () => void
  /** A dónde volver tras entrar con Google (el `?redirect=` del acceso). */
  redirect?: string | undefined
  /** Google devolvió al acceso sin sesión: se avisa encima de «Entrar». */
  googleFailed: boolean
  /** «Entrar con un código por email», con el email que ya se haya escrito. */
  onUseCode: (email: string) => void
}

/**
 * Entrar (diseño 11, G1): email y contraseña arriba, el código como enlace bajo «Entrar» (una
 * variante del mismo email, no un tercer botón), el «o» y Google como alternativa.
 */
export function LoginForm({ onSuccess, redirect, googleFailed, onUseCode }: LoginFormProps) {
  const signIn = useSignIn()
  const google = useGoogleSignIn({ redirect, returnedWithError: googleFailed })
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    signIn.mutate(values, { onSuccess })
  })

  // Una sola línea de error: la del último intento, con contraseña o con Google.
  const serverError = signIn.error ? authErrorMessage(signIn.error) : google.error

  return (
    <>
      <form
        onSubmit={(event) => {
          // Cualquier intento nuevo, aunque no pase la validación, se lleva el error de Google.
          google.dismiss()
          void onSubmit(event)
        }}
        noValidate
        className="flex flex-col gap-3"
      >
        <AuthField
          label="Email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Contraseña"
          placeholder="Contraseña"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError && <FormError message={serverError} />}

        <Button
          type="submit"
          disabled={signIn.isPending}
          className="h-13 w-full font-display text-base font-bold"
        >
          {signIn.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
        <button
          type="button"
          onClick={() => {
            onUseCode(getValues('email').trim())
          }}
          className="rounded-md py-1.5 text-center text-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Entrar con un código por email
        </button>
      </form>

      <OrSeparator />

      <GoogleButton
        opening={google.opening}
        onClick={() => {
          signIn.reset()
          google.start()
        }}
      />
    </>
  )
}
