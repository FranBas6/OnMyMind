import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'

import { requestEmailCode } from '../api'
import { authErrorMessage } from '../errors'
import { emailCodeRequestSchema, type AuthMode } from '../schemas'
import { AuthField, FormError } from './AuthField'
import { CodeLayout } from './CodeLayout'
import { Spinner } from './Spinner'

interface EmailStepProps {
  mode?: AuthMode | undefined
  /** El email que ya se escribió en Entrar o Crear cuenta (diseño 11: «se reutiliza»). */
  defaultEmail: string
  onBack: () => void
  onSent: (email: string, sentAt: number) => void
}

/** Paso 1 del código por email (diseño 11, K1–K3 y D4): a qué email lo mandamos. */
export function EmailStep({ mode, defaultEmail, onBack, onSent }: EmailStepProps) {
  const request = useMutation({ mutationFn: requestEmailCode })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(emailCodeRequestSchema),
    defaultValues: { email: defaultEmail },
  })

  const onSubmit = handleSubmit(({ email }) => {
    request.mutate(email, {
      onSuccess: () => {
        onSent(email, Date.now())
      },
    })
  })

  return (
    <CodeLayout
      title={mode === 'signup' ? 'Crear cuenta con un código' : 'Entrar con un código'}
      description="Te enviamos seis dígitos al email. Los escribes aquí y listo, sin contraseña."
      onBack={onBack}
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-3">
        <AuthField
          label="Email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="send"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />

        {request.error && <FormError message={authErrorMessage(request.error)} />}

        <Button
          type="submit"
          disabled={request.isPending}
          className="h-13 w-full gap-2.5 font-display text-base font-bold"
        >
          {request.isPending ? (
            <>
              <Spinner />
              Enviando…
            </>
          ) : (
            'Enviarme un código'
          )}
        </Button>
      </form>
    </CodeLayout>
  )
}
