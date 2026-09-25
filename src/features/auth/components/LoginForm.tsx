import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'

import { authErrorMessage } from '../errors'
import { useSignIn } from '../hooks/useAuthMutations'
import { signInSchema } from '../schemas'
import { AuthField, FormError, PasswordField } from './AuthField'

interface LoginFormProps {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const signIn = useSignIn()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    signIn.mutate(values, { onSuccess })
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {signIn.error && <FormError message={authErrorMessage(signIn.error)} />}

      <Button
        type="submit"
        disabled={signIn.isPending}
        className="mt-1 h-13 w-full font-display text-base font-bold"
      >
        {signIn.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
