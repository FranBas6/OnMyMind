import { useMutation } from '@tanstack/react-query'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { WifiOffIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InputOTP } from '@/components/ui/input-otp'
import { useNow } from '@/hooks/useNow'

import { requestEmailCode, verifyEmailCode } from '../api'
import {
  CODE_LENGTH,
  codeErrorKind,
  EXPIRED_CODE_MESSAGE,
  LOCKOUT_SECONDS,
  RESEND_AFTER_SECONDS,
  resendCountdownLabel,
  secondsUntil,
  TOO_MANY_ATTEMPTS_MESSAGE,
  WRONG_CODE_MESSAGE,
} from '../emailCode'
import { authErrorMessage } from '../errors'
import { FormError } from './AuthField'
import { CodeLayout } from './CodeLayout'
import { CodeSlots } from './CodeSlots'
import { Spinner } from './Spinner'

interface CodeStepProps {
  email: string
  /** Cuándo se mandó el último código: marca la cuenta atrás y si un fallo es que caducó. */
  sentAt: number
  /**
   * Viene de crear cuenta con contraseña: el código confirma la cuenta y la pantalla lo dice
   * («Confirma tu email», decisión de Fran en 1.17). Si no, «Revisa tu email» del diseño.
   */
  confirming: boolean
  onResent: (sentAt: number) => void
  /** «‹ Volver» y «Usar otro email»: al paso 1. */
  onChangeEmail: () => void
  onSignedIn: () => void
}

/** Lo que dice la línea bajo las casillas. `null`: nada. */
type Problem =
  | { kind: 'wrong' | 'expired' }
  | { kind: 'tooMany'; until: number }
  | { kind: 'other'; message: string }

/**
 * Paso 2 del código por email, «Revisa tu email» (diseño 11, K4–K10, D5 y D6). Seis casillas con
 * el teclado numérico; se puede pegar el código y, con la sexta cifra, se comprueba solo.
 */
export function CodeStep({
  email,
  sentAt,
  confirming,
  onResent,
  onChangeEmail,
  onSignedIn,
}: CodeStepProps) {
  const now = useNow()
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)

  const resend = useMutation({
    mutationFn: requestEmailCode,
    onSuccess: () => {
      onResent(Date.now())
    },
  })

  const verify = useMutation({
    mutationFn: verifyEmailCode,
    // Sin red, la comprobación espera en pausa y sale sola al volver (diseño 11, K10).
    networkMode: 'online',
    onSuccess: onSignedIn,
    onError: (error) => {
      const kind = codeErrorKind(error, sentAt, Date.now())
      if (kind === 'wrong') {
        setProblem({ kind: 'wrong' })
      } else if (kind === 'expired') {
        setProblem({ kind: 'expired' })
        setCode('')
        resend.mutate(email)
      } else if (kind === 'tooMany') {
        setProblem({ kind: 'tooMany', until: Date.now() + LOCKOUT_SECONDS * 1000 })
        setCode('')
      } else {
        setProblem({ kind: 'other', message: authErrorMessage(error) })
      }
    },
  })

  const locked = problem?.kind === 'tooMany' && now < problem.until
  // Pasado el bloqueo, el aviso de demasiados intentos ya no aplica.
  const shownProblem = problem?.kind === 'tooMany' && !locked ? null : problem
  const waitingForNetwork = verify.isPaused
  const checking = verify.isPending && !waitingForNetwork
  const complete = code.length === CODE_LENGTH

  const submit = (value: string) => {
    if (value.length !== CODE_LENGTH || locked || verify.isPending) return
    setProblem(null)
    verify.mutate({ email, token: value })
  }

  const resendAt = locked ? problem.until : sentAt + RESEND_AFTER_SECONDS * 1000
  // `now` puede ir hasta un segundo por detrás del instante del envío o del bloqueo: sin el tope,
  // saldría «61 s» o «6 min» durante el primer tic.
  const secondsLeft = Math.min(
    secondsUntil(resendAt, now),
    locked ? LOCKOUT_SECONDS : RESEND_AFTER_SECONDS,
  )

  let message: string | undefined
  if (shownProblem?.kind === 'wrong') message = WRONG_CODE_MESSAGE
  else if (shownProblem?.kind === 'expired') message = EXPIRED_CODE_MESSAGE
  else if (shownProblem?.kind === 'tooMany') message = TOO_MANY_ATTEMPTS_MESSAGE
  else if (shownProblem?.kind === 'other') message = shownProblem.message
  else if (resend.error) message = authErrorMessage(resend.error)

  return (
    <CodeLayout
      title={confirming ? 'Confirma tu email' : 'Revisa tu email'}
      description={
        confirming ? (
          <>
            Tu cuenta está casi lista. Escribe el código de seis dígitos que hemos enviado a{' '}
            <b className="font-semibold text-foreground">{email}</b>.
          </>
        ) : (
          <>
            Hemos enviado un código de seis dígitos a{' '}
            <b className="font-semibold text-foreground">{email}</b>. Puedes pegarlo entero.
          </>
        )
      }
      onBack={onChangeEmail}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit(code)
        }}
        className="-mt-0.5 flex flex-col gap-3"
      >
        <InputOTP
          maxLength={CODE_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={(value) => {
            setCode(value)
            // Escribir de nuevo se lleva el error (menos el bloqueo, que manda el servidor).
            if (problem && problem.kind !== 'tooMany') setProblem(null)
            resend.reset()
          }}
          onComplete={submit}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          disabled={locked}
          aria-label="Código de seis dígitos"
          aria-invalid={shownProblem ? true : undefined}
          containerClassName="has-disabled:opacity-100"
          render={({ slots }) => (
            <CodeSlots
              slots={slots}
              invalid={Boolean(shownProblem)}
              checking={checking}
              disabled={locked}
            />
          )}
        />

        {waitingForNetwork ? (
          <p className="flex items-center gap-1.5 px-1 text-[13px] leading-[1.4] text-subtle-foreground">
            <WifiOffIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
            Sin conexión. El código se comprobará cuando vuelva.
          </p>
        ) : (
          message && <FormError message={message} />
        )}

        <Button
          type="submit"
          disabled={!complete || locked || checking}
          className="h-13 w-full gap-2.5 font-display text-base font-bold"
        >
          {checking ? (
            <>
              <Spinner />
              Comprobando…
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>

      <div className="-mt-1 flex h-10 items-center justify-between text-sm font-semibold">
        {secondsLeft > 0 || resend.isPending ? (
          <span className="text-subtle-foreground">
            {resend.isPending ? 'Enviando…' : resendCountdownLabel(secondsLeft)}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setProblem(null)
              setCode('')
              resend.mutate(email)
            }}
            className="rounded-md text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Volver a enviar
          </button>
        )}
        <button
          type="button"
          onClick={onChangeEmail}
          className="rounded-md text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Usar otro email
        </button>
      </div>
    </CodeLayout>
  )
}
