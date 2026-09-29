import { useState } from 'react'

import { clearPendingCode, savePendingCode } from '../emailCode'
import type { AuthMode } from '../schemas'
import { CodeStep } from './CodeStep'
import { EmailStep } from './EmailStep'

/** Por dónde se entra al código: el paso 1 con un email ya escrito, o directo a las casillas. */
export type EmailCodeStart =
  | { step: 'email'; email: string }
  | { step: 'code'; email: string; sentAt: number; confirming?: boolean | undefined }

interface EmailCodeFlowProps {
  mode?: AuthMode | undefined
  start: EmailCodeStart
  /** «‹ Volver» desde el paso 1: de vuelta a Entrar o Crear cuenta. */
  onExit: () => void
  onSignedIn: () => void
}

/**
 * Entrar (o crear cuenta) con un código de seis dígitos por email, en dos pasos (diseño 11). El
 * paso 2 se guarda mientras el código vale, por si iOS cierra la app mientras miras el correo.
 */
export function EmailCodeFlow({ mode, start, onExit, onSignedIn }: EmailCodeFlowProps) {
  const [state, setState] = useState<EmailCodeStart>(() => {
    if (start.step === 'code') {
      const { email, sentAt, confirming } = start
      savePendingCode({ email, sentAt, mode, confirming })
    }
    return start
  })

  const goToCode = (email: string, sentAt: number, confirming = false) => {
    savePendingCode({ email, sentAt, mode, confirming })
    setState({ step: 'code', email, sentAt, confirming })
  }

  if (state.step === 'email') {
    return <EmailStep mode={mode} defaultEmail={state.email} onBack={onExit} onSent={goToCode} />
  }

  return (
    <CodeStep
      // Un email nuevo empieza de cero: sin cifras ni errores del anterior.
      key={state.email}
      email={state.email}
      sentAt={state.sentAt}
      confirming={state.confirming ?? false}
      onResent={(sentAt) => {
        goToCode(state.email, sentAt, state.confirming)
      }}
      onChangeEmail={() => {
        clearPendingCode()
        setState({ step: 'email', email: state.email })
      }}
      onSignedIn={() => {
        clearPendingCode()
        onSignedIn()
      }}
    />
  )
}
