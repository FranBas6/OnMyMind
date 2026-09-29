import { MailIcon } from 'lucide-react'

import { GoogleMark } from './GoogleButton'

interface SigningInScreenProps {
  /** Con qué se entra: la insignia de la marca y la frase cambian (diseño 11, G5 y K11). */
  via: 'google' | 'email'
}

/**
 * «Entrando…»: en `/auth/callback` mientras supabase-js canjea el código de Google, y tras un
 * código por email correcto mientras se abre Inicio. La marca lleva una insignia con la G o el sobre.
 */
export function SigningInScreen({ via }: SigningInScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-7 pb-20 text-center text-foreground">
      <div className="relative grid size-22 place-items-center">
        <img src="/logos/svg/omm-mark.svg" alt="" className="size-18 dark:hidden" />
        <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-18 dark:block" />
        <span className="absolute -right-1.5 -bottom-0.5 grid size-[34px] place-items-center rounded-full border border-border bg-card shadow-badge">
          {via === 'google' ? (
            <GoogleMark className="size-[18px]" />
          ) : (
            <MailIcon aria-hidden className="size-[18px] text-primary" strokeWidth={2} />
          )}
        </span>
      </div>
      <h1 className="text-[22px] tracking-[-0.02em]">Entrando…</h1>
      <p className="text-sm leading-normal text-muted-foreground">
        {via === 'google' ? 'Ya casi. Estamos trayendo tus listas.' : 'Comprobando el código.'}
      </p>
    </main>
  )
}
