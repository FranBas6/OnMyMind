import googleMarkUrl from '@/assets/google-g.svg'
import { cn } from '@/lib/utils'

import { Spinner } from './Spinner'

interface GoogleButtonProps {
  opening: boolean
  onClick: () => void
}

/**
 * «Continuar con Google» (diseño 11, G1–G3): el único botón secundario del acceso, con borde y la
 * G oficial. Mientras sale a Google, un arco que gira y «Abriendo Google…».
 */
export function GoogleButton({ opening, onClick }: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={opening}
      className={cn(
        'flex h-13 w-full items-center justify-center gap-2.5 rounded-md border-[1.5px] border-button-border bg-card text-[15px] font-semibold text-foreground outline-none',
        'hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-70',
      )}
    >
      {opening ? (
        <Spinner className="text-subtle-foreground" />
      ) : (
        <GoogleMark className="size-[18px]" />
      )}
      {opening ? 'Abriendo Google…' : 'Continuar con Google'}
    </button>
  )
}

/** La G de Google con sus cuatro colores de marca, iguales en claro y en oscuro. */
export function GoogleMark({ className }: { className: string }) {
  return <img src={googleMarkUrl} alt="" className={className} />
}

/** Separador «o» entre el acceso con email y Google (diseño 11). */
export function OrSeparator() {
  return (
    <div className="flex items-center gap-3 text-xs text-subtle-foreground">
      <span aria-hidden className="h-px flex-1 bg-border" />o
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}
