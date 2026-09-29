import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'

import { authErrorMessage } from '../errors'
import { useSignUp } from '../hooks/useAuthMutations'
import { useGoogleSignIn } from '../hooks/useGoogleSignIn'
import { PASSWORD_MIN_LENGTH, signUpSchema } from '../schemas'
import { AuthField, FormError, PasswordField } from './AuthField'
import { GoogleButton, OrSeparator } from './GoogleButton'

interface SignUpFormProps {
  onSuccess: () => void
  /** A dónde volver tras entrar con Google (el `?redirect=` del acceso). */
  redirect?: string | undefined
  /** Google devolvió al acceso sin sesión: se avisa encima de «Crear cuenta». */
  googleFailed: boolean
  /** «Crear cuenta con un código por email», con el email que ya se haya escrito. */
  onUseCode: (email: string) => void
  /** Cuenta creada pendiente de confirmar: el correo lleva el código y se pasa a las casillas. */
  onNeedsCode: (email: string) => void
}

/**
 * Crear cuenta (diseño Acceso, A6–A9, y diseño 11, G2): Google primero, porque crea la cuenta sola
 * con nombre y foto; tras el «o», email y contraseña, sin nombre.
 */
export function SignUpForm({
  onSuccess,
  redirect,
  googleFailed,
  onUseCode,
  onNeedsCode,
}: SignUpFormProps) {
  const signUp = useSignUp()
  const google = useGoogleSignIn({ redirect, mode: 'signup', returnedWithError: googleFailed })
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess: ({ needsCode }) => {
        if (needsCode) onNeedsCode(values.email)
        else onSuccess()
      },
    })
  })

  const serverError = signUp.error ? authErrorMessage(signUp.error) : google.error

  return (
    <>
      <div className="flex flex-col gap-3">
        <GoogleButton
          opening={google.opening}
          onClick={() => {
            signUp.reset()
            google.start()
          }}
        />
        <p className="text-center text-[13px] leading-[1.4] text-subtle-foreground">
          Se crea la cuenta sola, con tu nombre y tu foto.
        </p>
      </div>

      <OrSeparator />

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
          autoComplete="new-password"
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError && <FormError message={serverError} />}

        <Button
          type="submit"
          disabled={signUp.isPending}
          className="h-13 w-full font-display text-base font-bold"
        >
          {signUp.isPending ? 'Creando tu cuenta…' : 'Crear cuenta'}
        </Button>
        <button
          type="button"
          onClick={() => {
            onUseCode(getValues('email').trim())
          }}
          className="rounded-md py-1.5 text-center text-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Crear cuenta con un código por email
        </button>
      </form>
    </>
  )
}
