import { BackLink } from '@/components/layout/PageHeader'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import type { List } from '../types'

interface InboxHeaderProps {
  inbox: List
  /** «5 cosas sin ordenar» o «Nada sin ordenar». */
  summary: string
}

/**
 * Cabecera de «En mente» (diseño 05): el bloque índigo de su tarjeta de Inicio, que la distingue
 * del resto de listas sin icono ni inicial. Sin menú ···: no se edita, archiva ni borra. En
 * escritorio, más ancho, con el contador y una línea que explica qué es a la derecha. «‹ Listas»
 * encima en los dos (en escritorio, a petición de Fran; el diseño no lo lleva).
 */
export function InboxHeader({ inbox, summary }: InboxHeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return (
      <header className="flex flex-col gap-3">
        <BackLink to="/" label="Listas" />
        <div className="flex items-center justify-between gap-6 rounded-3xl bg-inbox-card px-[26px] py-[22px] text-white shadow-inbox-card">
          <div className="flex min-w-0 items-center gap-[18px]">
            <Mark className="size-14" />
            <div className="min-w-0">
              <Eyebrow />
              <h1 className="truncate text-[32px] leading-[1.1]">{inbox.name}</h1>
            </div>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p>{summary}</p>
            <p className="mt-0.5 text-xs opacity-85">Lo que capturas sin elegir lista cae aquí</p>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="flex flex-col gap-2">
      <BackLink to="/" label="Listas" />
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-inbox-card px-[18px] py-3.5 text-white shadow-inbox-card">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <Eyebrow withIcon />
          <h1 className="truncate text-[28px] leading-[1.1]">{inbox.name}</h1>
          <p className="text-sm">{summary}</p>
        </div>
        <Mark className="size-13" />
      </div>
    </header>
  )
}

function Eyebrow({ withIcon = false }: { withIcon?: boolean }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] uppercase opacity-85">
      {withIcon && <img src="/logos/svg/omm-mark-white.svg" alt="" className="size-3.5" />}
      Fijada
    </p>
  )
}

/** Círculo blanco al 18 % con el símbolo de la marca en blanco. */
function Mark({ className }: { className: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-white/18', className)}>
      <img src="/logos/svg/omm-mark-white.svg" alt="" className="size-7" />
    </span>
  )
}
