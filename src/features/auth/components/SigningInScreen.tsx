import { GoogleMark } from './GoogleButton'

/**
 * «Entrando…» (diseño 11, G5): lo que se ve en `/auth/callback` mientras supabase-js canjea el
 * código de Google por la sesión. La marca lleva una insignia con la G.
 */
export function SigningInScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-7 pb-20 text-center text-foreground">
      <div className="relative grid size-22 place-items-center">
        <img src="/logos/svg/omm-mark.svg" alt="" className="size-18 dark:hidden" />
        <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-18 dark:block" />
        <span className="absolute -right-1.5 -bottom-0.5 grid size-[34px] place-items-center rounded-full border border-border bg-card shadow-badge">
          <GoogleMark className="size-[18px]" />
        </span>
      </div>
      <h1 className="text-[22px] tracking-[-0.02em]">Entrando…</h1>
      <p className="text-sm leading-normal text-muted-foreground">
        Ya casi. Estamos trayendo tus listas.
      </p>
    </main>
  )
}
