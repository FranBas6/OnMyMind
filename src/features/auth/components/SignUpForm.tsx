import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'

import { authErrorMessage } from '../errors'
import { useSignUp } from '../hooks/useAuthMutations'
import { PASSWORD_MIN_LENGTH, signUpSchema } from '../schemas'
import { AuthField, FormError, PasswordField } from './AuthField'

interface SignUpFormProps {
  onSuccess: () => void
}

/** Crear cuenta (diseño Acceso, A6–A9): email y contraseña, sin nombre. */
export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const signUp = useSignUp()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, { onSuccess })
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-3">
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

      {signUp.error && <FormError message={authErrorMessage(signUp.error)} />}

      <Button
        type="submit"
        disabled={signUp.isPending}
        className="mt-1 h-13 w-full font-display text-base font-bold"
      >
        {signUp.isPending ? 'Creando tu cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
  )
}
