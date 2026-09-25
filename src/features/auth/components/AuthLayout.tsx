import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  /** Enlace inferior («¿Primera vez? Crear cuenta»): al fondo en móvil, bajo el formulario en escritorio. */
  footer?: ReactNode
}

/**
 * Estructura de la pantalla de acceso (diseño Acceso): marca arriba, formulario y pie.
 * En escritorio, la misma columna de 380 px centrada en la página, sin tarjeta.
 */
export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[calc(env(safe-area-inset-top)+4.5rem)] pr-[max(env(safe-area-inset-right),1.75rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)] pl-[max(env(safe-area-inset-left),1.75rem)] text-foreground md:justify-center md:py-10">
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col gap-10 md:flex-none">
        <header className="flex flex-col items-center gap-3.5">
          <img src="/logos/svg/omm-mark.svg" alt="" className="size-18 dark:hidden" />
          <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-18 dark:block" />
          <h1 className="text-[28px] leading-tight">OnMyMind</h1>
          <p className="-mt-1.5 text-base text-muted-foreground">Sácalo de la cabeza.</p>
        </header>

        {children}

        {footer && (
          <footer className="mt-auto text-center text-[13px] text-muted-foreground md:mt-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
