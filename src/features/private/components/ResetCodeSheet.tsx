import { useMutation } from '@tanstack/react-query'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useState } from 'react'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { InputOTP } from '@/components/ui/input-otp'
import {
  CODE_LENGTH,
  codeErrorKind,
  CodeSlots,
  EXPIRED_CODE_MESSAGE,
  FormError,
  RESEND_AFTER_SECONDS,
  resendCountdownLabel,
  secondsUntil,
  TOO_MANY_ATTEMPTS_MESSAGE,
  WRONG_CODE_MESSAGE,
} from '@/features/auth'
import { useNow } from '@/hooks/useNow'

import { sendResetCode, verifyResetCode } from '../api'
import { NEEDS_CONNECTION, SOMETHING_FAILED } from '../copy'
import { HeaderCancel, Lead, TextAction } from './SheetParts'

interface ResetCodeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  email: string
  sentAt: number
  onResent: (sentAt: number) => void
  onVerified: () => void
}

/**
 * «Revisa tu email» de «He olvidado la clave» (diseño 26, C5c, como el acceso de 11): seis
 * casillas que se comprueban solas al llenarse. Después se crea la clave nueva.
 */
export function ResetCodeSheet(props: ResetCodeSheetProps) {
  const { open, onOpenChange, isDesktop } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title="Revisa tu email"
      headerAction={<HeaderCancel />}
      closeHint
    >
      <ResetCodeForm {...props} />
    </ResponsiveSheet>
  )
}

function messageFor(error: unknown, sentAt: number): string {
  switch (codeErrorKind(error, sentAt, Date.now())) {
    case 'wrong':
      return WRONG_CODE_MESSAGE
    case 'expired':
      return EXPIRED_CODE_MESSAGE
    case 'tooMany':
      return TOO_MANY_ATTEMPTS_MESSAGE
    case 'offline':
      return NEEDS_CONNECTION
    case 'other':
      return SOMETHING_FAILED
  }
}

function ResetCodeForm({ email, sentAt, onResent, onVerified }: ResetCodeSheetProps) {
  const now = useNow()
  const [code, setCode] = useState('')
  const verify = useMutation({
    mutationFn: verifyResetCode,
    networkMode: 'always',
    onSuccess: onVerified,
  })
  const resend = useMutation({
    mutationFn: () => sendResetCode(email),
    networkMode: 'always',
    onSuccess: () => {
      setCode('')
      verify.reset()
      onResent(Date.now())
    },
  })

  const submit = (value: string) => {
    if (value.length !== CODE_LENGTH || verify.isPending) return
    verify.mutate({ email, token: value })
  }
  const secondsLeft = Math.min(
    secondsUntil(sentAt + RESEND_AFTER_SECONDS * 1000, now),
    RESEND_AFTER_SECONDS,
  )
  const error = verify.error
    ? messageFor(verify.error, sentAt)
    : resend.error
      ? messageFor(resend.error, sentAt)
      : null
  const canPaste = 'clipboard' in navigator && typeof navigator.clipboard.readText === 'function'

  return (
    <div className="flex flex-col gap-3">
      <Lead>
        Hemos enviado un código de seis dígitos a{' '}
        <b className="font-semibold text-foreground">{email}</b>. Después crearás la clave nueva.
      </Lead>
      <InputOTP
        maxLength={CODE_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={(value) => {
          setCode(value)
          verify.reset()
        }}
        onComplete={submit}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="Código de seis dígitos"
        aria-invalid={verify.isError ? true : undefined}
        render={({ slots }) => (
          <CodeSlots
            slots={slots}
            invalid={verify.isError}
            checking={verify.isPending}
            disabled={false}
          />
        )}
      />
      {error && <FormError message={error} />}
      <div className="flex h-9 items-center justify-between text-sm font-semibold">
        {secondsLeft > 0 || resend.isPending ? (
          <span className="text-subtle-foreground">
            {resend.isPending ? 'Enviando…' : resendCountdownLabel(secondsLeft)}
          </span>
        ) : (
          <TextAction
            onClick={() => {
              resend.mutate()
            }}
          >
            Volver a enviar
          </TextAction>
        )}
        {canPaste && (
          <TextAction
            onClick={() => {
              void navigator.clipboard.readText().then((text) => {
                const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH)
                setCode(digits)
                submit(digits)
              })
            }}
          >
            Pegar
          </TextAction>
        )}
      </div>
    </div>
  )
}
